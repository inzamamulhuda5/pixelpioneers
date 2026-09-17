import { DemoScenario } from '../types';

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'demo-cardio',
    name: 'Demo Case 1: Exertional Chest Tightness',
    badge: 'High Priority Triage',
    shortDescription:
      '52-year-old patient reporting retrosternal chest pressure and mild shortness of breath upon stair climbing.',
    chiefComplaint: "I've been feeling heaviness and pressure in the center of my chest since yesterday afternoon.",
    suggestedCity: 'Kolkata',
    sampleTranscript: [
      {
        role: 'user',
        text: "I've been feeling heaviness and pressure in the center of my chest since yesterday afternoon.",
      },
      {
        role: 'assistant',
        text: 'I understand this is concerning. To help evaluate this carefully: did this sensation start suddenly or come on gradually, and what were you doing when it first appeared?',
      },
      {
        role: 'user',
        text: 'It started gradually while climbing two flights of stairs at work. It felt like someone was pressing a weight on my chest.',
      },
      {
        role: 'assistant',
        text: 'Thank you for explaining that context. How severe would you rate this discomfort on a scale of 1 to 10 right now, and does the feeling radiate to your left arm, shoulder, or jaw?',
      },
      {
        role: 'user',
        text: 'It was about a 7 or 8 while climbing, now sitting down it is around 4/10. There is a dull ache extending towards my left shoulder.',
      },
      {
        role: 'assistant',
        text: 'Are you also experiencing any shortness of breath, unusual sweating, or dizziness with this discomfort?',
      },
      {
        role: 'user',
        text: 'Yes, mild breathlessness during the peak and some cold sweats. I also have borderline high blood pressure and take Amlodipine 5mg.',
      },
      {
        role: 'assistant',
        text: 'I have gathered sufficient structured information to prepare your clinical intake summary and triage indicator. Because chest pressure with exertional onset and radiation is a significant clinical indicator, prompt specialist evaluation is strongly recommended. You can review your assessment below.',
      },
    ],
    patientState: {
      chiefConcern: 'Exertional retrosternal chest pressure radiating to left shoulder',
      symptoms: [
        {
          id: 'sym-1',
          name: 'Retrosternal Chest Pressure',
          duration: '1 day (since yesterday afternoon)',
          severity: 8,
          pattern: 'Exertional / Fluctuating',
          triggers: ['Climbing stairs', 'Physical exertion'],
          notes: 'Heaviness sensation; improves slightly at rest (to 4/10)',
        },
        {
          id: 'sym-2',
          name: 'Left Shoulder Radiation',
          duration: '1 day',
          severity: 5,
          pattern: 'Concurrent with chest tightness',
        },
        {
          id: 'sym-3',
          name: 'Mild Dyspnea (Shortness of breath)',
          duration: 'Episodic with chest tightness',
          severity: 6,
          pattern: 'Exertional',
        },
      ],
      duration: '1 day',
      severity: 8,
      frequency: 'fluctuating',
      triggers: ['Physical exertion', 'Stair climbing'],
      associatedSymptoms: ['Mild shortness of breath', 'Cold sweating (diaphoresis)'],
      medicalHistory: ['Hypertension (borderline high blood pressure)'],
      medications: ['Amlodipine 5mg daily'],
      allergies: ['No known drug allergies (NKDA)'],
      lifestyleContext: ['Office worker', 'Moderate daily stress'],
      activityAtOnset: 'Climbing two flights of stairs at work',
      age: 52,
      sex: 'Male',
      emergencyIndicators: ['Exertional chest pressure', 'Radiation to left shoulder', 'Cold sweating'],
      reportedDocuments: [
        {
          id: 'doc-demo-1',
          fileName: 'Recent_Lipid_Profile_BP_Log.pdf',
          fileType: 'application/pdf',
          fileSize: '412 KB',
          uploadedAt: '2026-09-15',
          extractedTextSummary:
            'Blood Pressure log: 144/92 mmHg. Total Cholesterol: 218 mg/dL, LDL: 142 mg/dL. Rx: Tab Amlodipine 5mg od.',
          medications: ['Amlodipine 5mg'],
          priorConditions: ['Hypertension', 'Mild Dyslipidemia'],
          labFindings: ['Total Cholesterol: 218 mg/dL', 'BP: 144/92 mmHg'],
          suggestedSpecialty: 'Cardiology',
          source: 'uploaded_report',
        },
      ],
    },
    sampleDocument: {
      id: 'doc-demo-1',
      fileName: 'Recent_Lipid_Profile_BP_Log.pdf',
      fileType: 'application/pdf',
      fileSize: '412 KB',
      uploadedAt: '2026-09-15',
      extractedTextSummary:
        'Blood Pressure log: 144/92 mmHg. Total Cholesterol: 218 mg/dL, LDL: 142 mg/dL. Rx: Tab Amlodipine 5mg od.',
      medications: ['Amlodipine 5mg'],
      priorConditions: ['Hypertension', 'Mild Dyslipidemia'],
      labFindings: ['Total Cholesterol: 218 mg/dL', 'BP: 144/92 mmHg'],
      suggestedSpecialty: 'Cardiology',
      source: 'uploaded_report',
    },
  },
  {
    id: 'demo-neuro',
    name: 'Demo Case 2: Unilateral Throbbing Headache',
    badge: 'Moderate Triage',
    shortDescription:
      '31-year-old software engineer reporting 3-day unilateral pulsating headache, worsened by screen light and evening fatigue.',
    chiefComplaint: "I've had a bad throbbing headache on the right side of my head for three days now.",
    suggestedCity: 'Kolkata',
    sampleTranscript: [
      {
        role: 'user',
        text: "I've had a bad throbbing headache on the right side of my head for three days now.",
      },
      {
        role: 'assistant',
        text: 'I understand how disruptive headaches can be. When does the pain tend to peak during the day, and does anything like bright light or sound make it worse?',
      },
      {
        role: 'user',
        text: 'It builds up around late afternoon and gets worst around 6 or 7 PM after long hours looking at monitors. Bright monitor light definitely makes it pulse harder.',
      },
      {
        role: 'assistant',
        text: 'On a scale of 1 to 10, how intense does the headache get at its worst, and have you noticed any nausea or visual disturbances like flashing spots?',
      },
      {
        role: 'user',
        text: 'It reaches around 6 out of 10. A little bit of mild nausea when it pulses, but no blind spots or fever. Rest in a dark room gives slight relief.',
      },
      {
        role: 'assistant',
        text: 'Are you taking any over-the-counter pain medications, and have you had similar headaches in the past?',
      },
      {
        role: 'user',
        text: 'I took Paracetamol 650mg yesterday which took the edge off for 2 hours, but it returned. I used to get mild headaches occasionally during exam periods.',
      },
      {
        role: 'assistant',
        text: 'I have collected enough structured details to create your intake summary. The symptoms are consistent with features commonly seen in tension-type or migraine cephalea. You can review your assessment summary and match with a clinic or neurologist below.',
      },
    ],
    patientState: {
      chiefConcern: 'Unilateral pulsating headache with photophobia for 3 days',
      symptoms: [
        {
          id: 'sym-headache',
          name: 'Unilateral Throbbing Headache (Right-sided)',
          duration: '3 days',
          severity: 6,
          pattern: 'Intermittent / Late afternoon peak',
          triggers: ['Prolonged screen glare', 'Fatigue'],
          notes: 'Temporary relief with OTC analgesics and dark room rest',
        },
        {
          id: 'sym-photo',
          name: 'Photophobia (Light sensitivity)',
          duration: '3 days',
          severity: 5,
          pattern: 'Coincides with headache peak',
        },
      ],
      duration: '3 days',
      severity: 6,
      frequency: 'intermittent',
      triggers: ['Computer screen exposure', 'Evening fatigue'],
      associatedSymptoms: ['Mild nausea', 'Sensitivity to bright lights'],
      medicalHistory: ['Occasional episodic tension headaches during high stress periods'],
      medications: ['Paracetamol 650mg PRN (as needed)'],
      allergies: ['No known drug allergies'],
      lifestyleContext: ['Software developer', '8-10 hours daily monitor time', 'Irregular sleep habits'],
      activityAtOnset: 'Working late on laptop before evening onset',
      age: 31,
      sex: 'Female',
      emergencyIndicators: [],
      reportedDocuments: [
        {
          id: 'doc-demo-2',
          fileName: 'Previous_Ophthalmic_Exam_Report.jpg',
          fileType: 'image/jpeg',
          fileSize: '290 KB',
          uploadedAt: '2026-08-20',
          extractedTextSummary:
            'Eye examination: Visual acuity 6/6 OU with existing corrective lenses. Normal intraocular pressure (14 mmHg). Mild digital eye strain advised 20-20-20 rule.',
          medications: ['Lubricating eye drops as needed'],
          priorConditions: ['Digital Asthenopia / Eye Strain'],
          labFindings: ['IOP: 14 mmHg (Normal)', 'Fundus: Clear'],
          suggestedSpecialty: 'Neurology',
          source: 'uploaded_report',
        },
      ],
    },
    sampleDocument: {
      id: 'doc-demo-2',
      fileName: 'Previous_Ophthalmic_Exam_Report.jpg',
      fileType: 'image/jpeg',
      fileSize: '290 KB',
      uploadedAt: '2026-08-20',
      extractedTextSummary:
        'Eye examination: Visual acuity 6/6 OU with existing corrective lenses. Normal intraocular pressure (14 mmHg). Mild digital eye strain advised 20-20-20 rule.',
      medications: ['Lubricating eye drops as needed'],
      priorConditions: ['Digital Asthenopia / Eye Strain'],
      labFindings: ['IOP: 14 mmHg (Normal)', 'Fundus: Clear'],
      suggestedSpecialty: 'Neurology',
      source: 'uploaded_report',
    },
  },
];
