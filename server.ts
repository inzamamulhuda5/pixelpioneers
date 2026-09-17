import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
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

// ================= GLOBAL CROSS-DEVICE SLOT HOLD & BOOKING SYSTEM =================

interface ServerSlotHold {
  slotId: string;
  doctorId: string;
  date: string;
  time: string;
  sessionId: string;
  heldAt: number;
  expiresAt: number;
  label?: string;
}

interface ServerSlotBooked {
  slotId: string;
  doctorId?: string;
  date?: string;
  time?: string;
  bookedAt: number;
  patientName?: string;
}

const serverHeldSlots = new Map<string, ServerSlotHold>();
const serverBookedSlots = new Map<string, ServerSlotBooked>();
const sseClients = new Set<Response>();

const SLOTS_CACHE_FILE = path.join(process.cwd(), '.slots_cache.json');

function loadSlotsCache() {
  try {
    if (fs.existsSync(SLOTS_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SLOTS_CACHE_FILE, 'utf-8'));
      const now = Date.now();
      if (Array.isArray(data.heldSlots)) {
        for (const h of data.heldSlots) {
          if (h && h.expiresAt > now) {
            serverHeldSlots.set(h.slotId, h);
          }
        }
      }
      if (Array.isArray(data.bookedSlots)) {
        for (const b of data.bookedSlots) {
          if (typeof b === 'string') {
            serverBookedSlots.set(b, { slotId: b, bookedAt: now });
          } else if (b && b.slotId) {
            serverBookedSlots.set(b.slotId, b);
          }
        }
      }
    }
  } catch {
    // Ignore cache load issues
  }
}

function saveSlotsCache() {
  try {
    const data = {
      heldSlots: Array.from(serverHeldSlots.values()),
      bookedSlots: Array.from(serverBookedSlots.values()),
    };
    fs.writeFileSync(SLOTS_CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {
    // Ignore cache write issues
  }
}

loadSlotsCache();

function cleanupExpiredHolds(): boolean {
  const now = Date.now();
  let changed = false;
  for (const [slotId, hold] of serverHeldSlots.entries()) {
    if (hold.expiresAt <= now) {
      serverHeldSlots.delete(slotId);
      changed = true;
    }
  }
  if (changed) {
    saveSlotsCache();
  }
  return changed;
}

function broadcastSlotUpdate(eventData: any = { type: 'SLOTS_UPDATED', timestamp: Date.now() }) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Periodic cleanup of expired holds every 2 seconds
setInterval(() => {
  if (cleanupExpiredHolds()) {
    broadcastSlotUpdate({ type: 'HOLDS_EXPIRED', timestamp: Date.now() });
  }
}, 2000);

// SSE Stream for real-time cross-device slot synchronization
app.get('/api/slots/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  sseClients.add(res);

  // Immediate handshake message
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Get global slot availability across all devices
app.get('/api/slots/availability', (req: Request, res: Response) => {
  cleanupExpiredHolds();
  const { doctorId, date, sessionId } = req.query as {
    doctorId?: string;
    date?: string;
    sessionId?: string;
  };
  const clientSession = sessionId || '';

  const activeHolds: Record<
    string,
    {
      slotId: string;
      doctorId: string;
      date: string;
      time: string;
      expiresAt: number;
      heldByMe: boolean;
      label: string;
    }
  > = {};

  for (const [slotId, hold] of serverHeldSlots.entries()) {
    if (hold.expiresAt > Date.now()) {
      if ((!doctorId || hold.doctorId === doctorId) && (!date || hold.date === date)) {
        const isHeldByMe = Boolean(clientSession && hold.sessionId === clientSession);
        activeHolds[slotId] = {
          slotId,
          doctorId: hold.doctorId,
          date: hold.date,
          time: hold.time,
          expiresAt: hold.expiresAt,
          heldByMe: isHeldByMe,
          label: isHeldByMe ? 'Held for you' : 'Held by patient',
        };
      }
    }
  }

  const bookedList: string[] = [];
  for (const [slotId, b] of serverBookedSlots.entries()) {
    if ((!doctorId || !b.doctorId || b.doctorId === doctorId) && (!date || !b.date || b.date === date)) {
      bookedList.push(slotId);
    }
  }

  res.json({
    success: true,
    serverTime: Date.now(),
    heldSlots: activeHolds,
    bookedSlots: bookedList,
  });
});

// Hold a slot across all devices
app.post('/api/slots/hold', (req: Request, res: Response) => {
  cleanupExpiredHolds();
  const { slotId, doctorId, date, time, sessionId, durationSeconds = 300 } = req.body;

  if (!slotId || !sessionId) {
    return res.status(400).json({ success: false, message: 'slotId and sessionId are required' });
  }

  if (serverBookedSlots.has(slotId)) {
    return res.status(409).json({
      success: false,
      message: 'This slot was just booked by another patient. Please choose an available slot.',
    });
  }

  const existingHold = serverHeldSlots.get(slotId);
  if (existingHold && existingHold.expiresAt > Date.now() && existingHold.sessionId !== sessionId) {
    return res.status(409).json({
      success: false,
      message: 'This slot is currently held by another patient. Please choose another available slot.',
    });
  }

  // Release any other slot previously held by THIS session so each user holds at most 1 slot
  for (const [id, h] of serverHeldSlots.entries()) {
    if (h.sessionId === sessionId && id !== slotId) {
      serverHeldSlots.delete(id);
    }
  }

  const expiresAt = Date.now() + durationSeconds * 1000;
  const holdRecord: ServerSlotHold = {
    slotId,
    doctorId: doctorId || '',
    date: date || '',
    time: time || '',
    sessionId,
    heldAt: Date.now(),
    expiresAt,
    label: 'Held for you',
  };

  serverHeldSlots.set(slotId, holdRecord);
  saveSlotsCache();

  // Instant notification to all connected devices
  broadcastSlotUpdate({
    type: 'SLOT_HELD',
    slotId,
    doctorId,
    date,
    time,
    sessionId,
    expiresAt,
  });

  res.json({
    success: true,
    slotId,
    heldUntil: expiresAt,
    message: 'Slot held successfully across devices',
  });
});

// Release a slot hold
app.post('/api/slots/release', (req: Request, res: Response) => {
  const { slotId, sessionId } = req.body;
  let changed = false;

  if (slotId) {
    const existing = serverHeldSlots.get(slotId);
    if (existing && (!sessionId || existing.sessionId === sessionId)) {
      serverHeldSlots.delete(slotId);
      changed = true;
    }
  } else if (sessionId) {
    for (const [id, h] of serverHeldSlots.entries()) {
      if (h.sessionId === sessionId) {
        serverHeldSlots.delete(id);
        changed = true;
      }
    }
  }

  if (changed) {
    saveSlotsCache();
    broadcastSlotUpdate({
      type: 'SLOT_RELEASED',
      slotId,
      sessionId,
      timestamp: Date.now(),
    });
  }

  res.json({ success: true });
});

// Confirm booking and permanently book slot
app.post('/api/slots/book', (req: Request, res: Response) => {
  cleanupExpiredHolds();
  const { slotId, doctorId, date, time, sessionId, appointment } = req.body;

  if (!slotId) {
    return res.status(400).json({ success: false, message: 'slotId is required' });
  }

  if (serverBookedSlots.has(slotId)) {
    return res.status(409).json({
      success: false,
      message: 'This slot is no longer available. Another patient just completed booking this time.',
    });
  }

  const existingHold = serverHeldSlots.get(slotId);
  if (existingHold && existingHold.expiresAt > Date.now() && existingHold.sessionId !== sessionId) {
    return res.status(409).json({
      success: false,
      message: 'This slot is currently held by another patient and cannot be booked.',
    });
  }

  // Permanently mark as booked
  serverBookedSlots.set(slotId, {
    slotId,
    doctorId: doctorId || appointment?.doctor?.id || '',
    date: date || appointment?.date || '',
    time: time || appointment?.time || '',
    bookedAt: Date.now(),
    patientName: appointment?.patientName,
  });

  // Remove the temporary hold
  serverHeldSlots.delete(slotId);
  saveSlotsCache();

  // Instant notification to all connected devices
  broadcastSlotUpdate({
    type: 'SLOT_BOOKED',
    slotId,
    doctorId,
    date,
    time,
    timestamp: Date.now(),
  });

  res.json({ success: true, slotId, appointment });
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
