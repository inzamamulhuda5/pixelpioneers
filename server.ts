import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

// Lazy initialization of Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Multi-model generator with fallback for high throughput and quota resilience
async function generateWithFallback(
  ai: GoogleGenAI,
  requestParams: {
    models?: string[];
    contents: any;
    config?: any;
  }
) {
  const models = requestParams.models || ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: requestParams.contents,
        config: requestParams.config,
      });
      if (response && (response.text || response.candidates?.length)) {
        return { response, model };
      }
    } catch (err: any) {
      // If quota (429) or high demand (503) or transient error, continue to next model
      continue;
    }
  }

  return null;
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

// AI Chat endpoint with Gemini and heuristic fallback
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages, patientState, isVoice } = req.body;
    const ai = getGeminiClient();

    if (ai) {
      const voiceConstraint = isVoice
        ? `
CRITICAL VOICE MODE RULES:
- The user is conversing via live voice. Your response MUST be spoken aloud.
- Keep your entire response to 1 or 2 short, natural sentences (maximum 35 words).
- Acknowledge what the user shared in a few words, then ask strictly ONE single question.
- NEVER ask multiple questions in a turn (e.g. do NOT ask "When did it start and how bad is it?").
- Check patientState: If duration is already known, do NOT ask for duration. If severity is already rated (1-10), do NOT ask for severity.
- When sufficient details are gathered, say: "I have gathered enough information to prepare your assessment. You can review it below or attach a report."`
        : '';

      const systemInstruction = `You are Pixel Pioneers Clinical Intake Assistant, a calm, friendly, empathetic, non-judgmental healthcare coordination assistant.
IMPORTANT SAFETY BOUNDARIES:
- You are an intake assistant, NOT a doctor.
- Never provide a definitive diagnosis or prescribe medication.
- Use safe phrasing like "Based on what you've shared...", "Symptoms like this may be associated with...".
- Ask ONE concise, relevant follow-up question at a time.
- Do NOT dump lists of questions. Be natural and conversational.
- Target collecting: chief concern, duration, severity (1-10), pattern (constant vs coming and going), triggers or what they were doing when it started, and key associated symptoms.
- If you already have enough information (or 4-5 turns have passed and key questions are answered), inform the user: "I have gathered enough information to compile your clinical summary and transparent triage assessment. You can proceed to view your assessment or attach any prescriptions/reports if you have them."
- Detect emergency red-flags (crushing chest pain radiating to arm/jaw, acute shortness of breath, sudden facial drooping/slurred speech, severe hemorrhage) and prominently advise immediate emergency medical care (e.g. 102/112 or nearest emergency department).${voiceConstraint}`;

      const contents = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const result = await generateWithFallback(ai, {
        models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: isVoice ? 90 : 300,
        },
      });

      if (result?.response?.text) {
        return res.json({ reply: result.response.text, source: 'gemini', model: result.model });
      }
    }
  } catch (error: any) {
    // Graceful fallback to client clinical intake heuristics
  }

  // Fallback heuristic response
  return res.json({
    reply: null, // Client-side intelligent engine will handle smoothly
    source: 'fallback',
  });
});

// AI Document Analysis endpoint
app.post('/api/ai/analyze-document', async (req: Request, res: Response) => {
  try {
    const { fileData, fileName, mimeType } = req.body;
    const ai = getGeminiClient();

    if (ai && fileData) {
      const prompt = `Analyze this medical document or prescription. Extract structured findings:
1. Patient name or age/sex if mentioned (do not invent).
2. Medications listed (name, dosage, frequency if present).
3. Stated clinical impressions or prior diagnoses.
4. Relevant lab values, vital signs, or clinical notes.
5. Recommended specialty.
Format output strictly as JSON with keys: extractedTextSummary, medications (array of strings), priorConditions (array of strings), labFindings (array of strings), suggestedSpecialty (string).`;

      const result = await generateWithFallback(ai, {
        models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: fileData,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (result?.response?.text) {
        const text = result.response.text;
        try {
          const parsed = JSON.parse(text);
          return res.json({ success: true, data: parsed, source: 'gemini' });
        } catch {
          return res.json({ success: true, rawText: text, source: 'gemini' });
        }
      }
    }
  } catch (error: any) {
    // Fallback quietly
  }

  return res.json({
    success: false,
    message: 'AI document parsing fallback',
    source: 'fallback',
  });
});

// AI Synthesis & Assessment endpoint
app.post('/api/ai/synthesize-assessment', async (req: Request, res: Response) => {
  try {
    const { patientState, documentFindings } = req.body;
    const ai = getGeminiClient();

    if (ai) {
      const prompt = `Based strictly on the following patient intake data and document findings, generate a concise clinical summary paragraph and specialty recommendation.
Patient Data: ${JSON.stringify(patientState)}
Document Findings: ${JSON.stringify(documentFindings || [])}

Rules:
- Do NOT make a definitive diagnosis.
- State what symptoms were reported, their duration, severity, and pattern.
- Return JSON with:
{
  "summary": "Short 2-3 sentence clinical narrative...",
  "recommendedSpecialty": "General Medicine | Cardiology | Neurology | Dermatology | Orthopedics | Gastroenterology | ENT | Pediatrics",
  "specialtyRationale": "Brief 1-sentence reason for this specialty choice."
}`;

      const result = await generateWithFallback(ai, {
        models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      if (result?.response?.text) {
        const parsed = JSON.parse(result.response.text || '{}');
        return res.json({ success: true, data: parsed });
      }
    }
  } catch (error: any) {
    // Fallback quietly
  }

  return res.json({ success: false, source: 'fallback' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pixel Pioneers server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
