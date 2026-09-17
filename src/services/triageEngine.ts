import {
  AssessmentResult,
  DocumentFinding,
  PatientIntakeState,
  RiskIndicator,
  TriageCategory,
} from '../types';

export function evaluateClinicalTriage(
  patientState: PatientIntakeState,
  documentFindings: DocumentFinding[] = []
): AssessmentResult {
  const indicators: RiskIndicator[] = [];

  // 1. High Symptom Severity (>= 7/10)
  if (patientState.severity !== null && patientState.severity !== undefined) {
    const isHigh = patientState.severity >= 7;
    indicators.push({
      id: 'ind-severity',
      label: 'Reported Symptom Severity',
      source: 'conversation',
      matched: isHigh,
      evidence: `User reported intensity of ${patientState.severity}/10${isHigh ? ' (Threshold >= 7/10)' : ' (Below high alert threshold)'}`,
      weight: isHigh ? (patientState.severity >= 9 ? 'urgent' : 'high') : 'low',
    });
  } else {
    indicators.push({
      id: 'ind-severity',
      label: 'Reported Symptom Severity',
      source: 'conversation',
      matched: null,
      evidence: 'Information not specified during interview',
      weight: 'low',
    });
  }

  // 2. Sudden / Hyperacute Onset
  const hasSuddenOnset =
    patientState.symptoms.some((s) => s.pattern?.toLowerCase().includes('sudden')) ||
    patientState.chiefConcern.toLowerCase().includes('sudden') ||
    (patientState.activityAtOnset || '').toLowerCase().includes('sudden');
  const hasGradualOnset =
    patientState.symptoms.some((s) => s.pattern?.toLowerCase().includes('gradual')) ||
    patientState.chiefConcern.toLowerCase().includes('gradual') ||
    patientState.duration?.toLowerCase().includes('day') ||
    patientState.duration?.toLowerCase().includes('week');

  if (hasSuddenOnset) {
    indicators.push({
      id: 'ind-onset',
      label: 'Sudden or Hyperacute Onset',
      source: 'conversation',
      matched: true,
      evidence: 'Symptoms appeared suddenly with abrupt onset',
      weight: 'high',
    });
  } else if (hasGradualOnset) {
    indicators.push({
      id: 'ind-onset',
      label: 'Sudden or Hyperacute Onset',
      source: 'conversation',
      matched: false,
      evidence: 'User reported gradual progression over time',
      weight: 'low',
    });
  } else {
    indicators.push({
      id: 'ind-onset',
      label: 'Sudden or Hyperacute Onset',
      source: 'conversation',
      matched: null,
      evidence: 'Onset speed not specified',
      weight: 'low',
    });
  }

  // 3. Chest Pressure / Radiating Pain / Anginal Features
  const allText = [
    patientState.chiefConcern,
    ...patientState.symptoms.map((s) => `${s.name} ${s.notes || ''}`),
    ...patientState.associatedSymptoms,
    ...patientState.emergencyIndicators,
  ]
    .join(' ')
    .toLowerCase();

  const hasCardiacRedFlag =
    allText.includes('chest') &&
    (allText.includes('pressure') ||
      allText.includes('heaviness') ||
      allText.includes('tightness') ||
      allText.includes('radiat') ||
      allText.includes('arm') ||
      allText.includes('jaw') ||
      allText.includes('shoulder'));

  indicators.push({
    id: 'ind-cardiac',
    label: 'Chest Pain / Anginal Radiation Pattern',
    source: 'conversation',
    matched: hasCardiacRedFlag,
    evidence: hasCardiacRedFlag
      ? 'Retrosternal pressure/tightness radiating to shoulder or arm reported'
      : 'No chest discomfort or cardiac-type radiation reported',
    weight: hasCardiacRedFlag ? 'urgent' : 'low',
  });

  // 4. Respiratory Distress / Dyspnea
  const hasDyspnea =
    allText.includes('breath') ||
    allText.includes('dyspnea') ||
    allText.includes('gasp') ||
    allText.includes('wheez');

  indicators.push({
    id: 'ind-dyspnea',
    label: 'Breathing Difficulty / Shortness of Breath',
    source: 'conversation',
    matched: hasDyspnea,
    evidence: hasDyspnea
      ? 'User reported shortness of breath or exertional breathlessness'
      : 'No breathing difficulty reported during intake',
    weight: hasDyspnea ? 'high' : 'low',
  });

  // 5. Autonomic Signs (Diaphoresis / Cold Sweats / Syncope)
  const hasAutonomic =
    allText.includes('sweat') ||
    allText.includes('diaphor') ||
    allText.includes('faint') ||
    allText.includes('dizz');

  indicators.push({
    id: 'ind-autonomic',
    label: 'Autonomic Symptoms (Cold Sweating / Dizziness / Syncope)',
    source: 'conversation',
    matched: hasAutonomic,
    evidence: hasAutonomic
      ? 'User reported cold sweating, lightheadedness or diaphoresis'
      : 'No diaphoresis or syncope reported',
    weight: hasAutonomic ? 'moderate' : 'low',
  });

  // 6. Neurological Deficits / Red Flags (Speech slurring, weakness, vision loss)
  const hasNeuroDeficit =
    allText.includes('slur') ||
    allText.includes('numb') ||
    allText.includes('weakness in arm') ||
    allText.includes('vision loss') ||
    allText.includes('double vision');

  indicators.push({
    id: 'ind-neuro',
    label: 'Focal Neurological Deficits',
    source: 'conversation',
    matched: hasNeuroDeficit,
    evidence: hasNeuroDeficit
      ? 'Focal weakness, speech difficulty or acute vision changes identified'
      : 'No acute focal motor/sensory deficits noted',
    weight: hasNeuroDeficit ? 'urgent' : 'low',
  });

  // 7. Systemic Fever / Infectious Signs
  const hasFever =
    allText.includes('fever') ||
    allText.includes('chill') ||
    allText.includes('temperature') ||
    allText.includes('pyrexia');

  indicators.push({
    id: 'ind-fever',
    label: 'Systemic Fever or Rigors',
    source: 'conversation',
    matched: hasFever,
    evidence: hasFever ? 'User reported elevated temperature or chills' : 'No fever or chills reported',
    weight: hasFever ? 'moderate' : 'low',
  });

  // 8. Relevant Chronic Medical History / Document Findings
  const docFindingsList = documentFindings.flatMap((d) => [
    ...(d.priorConditions || []),
    ...(d.labFindings || []),
  ]);
  const hasMedicalHistory = patientState.medicalHistory.length > 0 || docFindingsList.length > 0;
  const historyDetails = [
    ...patientState.medicalHistory,
    ...docFindingsList,
  ].filter(Boolean);

  indicators.push({
    id: 'ind-history',
    label: 'Relevant Pre-existing Medical History or Lab Findings',
    source: docFindingsList.length > 0 ? 'document' : 'conversation',
    matched: hasMedicalHistory,
    evidence: hasMedicalHistory
      ? `Documented history: ${historyDetails.slice(0, 3).join(', ')}`
      : 'No pre-existing chronic conditions disclosed',
    weight: hasMedicalHistory ? 'moderate' : 'low',
  });

  // 9. Age Risk Factor (Age > 50 or infant < 2)
  if (patientState.age !== null && patientState.age !== undefined) {
    const isAgeFactor = patientState.age >= 50 || patientState.age <= 2;
    indicators.push({
      id: 'ind-age',
      label: 'Age-Related Clinical Vulnerability Factor',
      source: 'profile',
      matched: isAgeFactor,
      evidence: `Reported age: ${patientState.age} years old${isAgeFactor ? ' (Higher risk demographic group)' : ' (Standard adult age range)'}`,
      weight: isAgeFactor ? 'moderate' : 'low',
    });
  } else {
    indicators.push({
      id: 'ind-age',
      label: 'Age-Related Clinical Vulnerability Factor',
      source: 'profile',
      matched: null,
      evidence: 'Age not provided during this session',
      weight: 'low',
    });
  }

  // 10. Prolonged Duration (> 2 weeks) vs Acute
  const durationText = (patientState.duration || '').toLowerCase();
  const isProlonged =
    durationText.includes('week') ||
    durationText.includes('month') ||
    durationText.includes('year');

  if (patientState.duration) {
    indicators.push({
      id: 'ind-duration',
      label: 'Prolonged Symptom Duration (> 1-2 Weeks)',
      source: 'conversation',
      matched: isProlonged,
      evidence: `Reported symptom duration: ${patientState.duration}`,
      weight: isProlonged ? 'moderate' : 'low',
    });
  } else {
    indicators.push({
      id: 'ind-duration',
      label: 'Prolonged Symptom Duration (> 1-2 Weeks)',
      source: 'conversation',
      matched: null,
      evidence: 'Duration not specified',
      weight: 'low',
    });
  }

  // Calculate score and triage category
  let matchedUrgent = 0;
  let matchedHigh = 0;
  let matchedModerate = 0;
  let matchedLow = 0;

  indicators.forEach((ind) => {
    if (ind.matched === true) {
      if (ind.weight === 'urgent') matchedUrgent++;
      else if (ind.weight === 'high') matchedHigh++;
      else if (ind.weight === 'moderate') matchedModerate++;
      else matchedLow++;
    }
  });

  const matchedCount = indicators.filter((i) => i.matched === true).length;
  const unmatchedCount = indicators.filter((i) => i.matched === false).length;
  const unknownCount = indicators.filter((i) => i.matched === null).length;

  let category: TriageCategory = 'LOW';
  let score = 25;
  let explanation = '';
  let isEmergency = false;
  let emergencyGuidance: string | undefined = undefined;

  if (matchedUrgent > 0) {
    category = 'URGENT';
    score = 90;
    isEmergency = true;
    emergencyGuidance =
      'Based on the reported symptoms (including acute chest pressure or potential anginal features), immediate emergency medical evaluation is strongly recommended. Do not wait for a routine clinic appointment if symptoms worsen, or call local emergency dispatch (102 / 112) immediately.';
    explanation =
      'The current triage indicator is placed at URGENT primarily due to reported retrosternal chest pressure with exertional features, potential cardiovascular radiation, or high symptom intensity.';
  } else if (matchedHigh >= 1 || (matchedModerate >= 2 && (patientState.severity || 0) >= 7)) {
    category = 'HIGH';
    score = 72;
    explanation =
      'The triage indicator is rated HIGH based on significant symptom severity (rated ' +
      (patientState.severity || 7) +
      '/10) and multiple concurrent indicators requiring prompt medical consultation within 24-48 hours.';
  } else if (matchedModerate >= 1 || (patientState.severity || 0) >= 5 || isProlonged) {
    category = 'MODERATE';
    score = 48;
    explanation =
      'The triage indicator is evaluated as MODERATE based on persistent or intermittent symptoms (duration: ' +
      (patientState.duration || 'several days') +
      ', severity: ' +
      (patientState.severity || '5') +
      '/10) that warrant planned clinical evaluation and diagnostic review.';
  } else {
    category = 'LOW';
    score = 22;
    explanation =
      'The current triage indicator is evaluated as LOW based on mild reported symptom intensity and the absence of acute red-flag indicators. Routine consultation is suitable.';
  }

  // Specialty Matching Logic
  const { specialty, rationale } = determineRecommendedSpecialty(patientState, documentFindings);

  // Generate AI Summary Text
  const aiSummaryText = generateNarrativeSummary(patientState, documentFindings, category, specialty);

  return {
    id: 'asmt-' + Date.now(),
    createdAt: new Date().toISOString(),
    patientSummary: {
      chiefConcern: patientState.chiefConcern || 'General health consultation',
      symptoms: patientState.symptoms,
      duration: patientState.duration,
      severity: patientState.severity,
      frequency: patientState.frequency,
      associatedSymptoms: patientState.associatedSymptoms,
      medicalHistory: patientState.medicalHistory,
      medications: patientState.medications,
      lifestyleContext: patientState.lifestyleContext,
    },
    documentFindings,
    aiSummaryText,
    recommendedSpecialty: specialty,
    specialtyRationale: rationale,
    triage: {
      category,
      score,
      explanation,
      indicators,
      matchedCount,
      unmatchedCount,
      unknownCount,
      isEmergency,
      emergencyGuidance,
    },
  };
}

export function determineRecommendedSpecialty(
  patientState: PatientIntakeState,
  documentFindings: DocumentFinding[] = []
): { specialty: string; rationale: string } {
  // Check if an attached document explicitly suggested a specialty
  const docSpecialty = documentFindings.find((d) => d.suggestedSpecialty)?.suggestedSpecialty;
  if (docSpecialty) {
    return {
      specialty: docSpecialty,
      rationale: `Derived from clinical laboratory notes and prescription history in attached medical report.`,
    };
  }

  const text = [
    patientState.chiefConcern,
    ...patientState.symptoms.map((s) => s.name + ' ' + (s.notes || '')),
    ...patientState.associatedSymptoms,
  ]
    .join(' ')
    .toLowerCase();

  // 1. Pediatric check
  if (patientState.age !== null && patientState.age < 16) {
    return {
      specialty: 'Pediatrics',
      rationale: 'Patient is under 16 years of age; specialized pediatric care is recommended.',
    };
  }

  // 2. Cardiology
  if (
    text.includes('chest') ||
    text.includes('heart') ||
    text.includes('palpitat') ||
    text.includes('angina') ||
    text.includes('hypertens') ||
    text.includes('blood pressure') ||
    text.includes('cholesterol')
  ) {
    return {
      specialty: 'Cardiology',
      rationale:
        'Reported symptoms include chest pressure, exertional tightness, or cardiovascular indicators that suggest cardiology evaluation.',
    };
  }

  // 3. Neurology
  if (
    text.includes('headache') ||
    text.includes('migraine') ||
    text.includes('dizzi') ||
    text.includes('vertigo') ||
    text.includes('seizure') ||
    text.includes('numb') ||
    text.includes('nerve') ||
    text.includes('photophobia')
  ) {
    return {
      specialty: 'Neurology',
      rationale:
        'Symptoms indicate neurological involvement such as unilateral cephalea, sensory sensitivity, or headache patterns.',
    };
  }

  // 4. Dermatology
  if (
    text.includes('skin') ||
    text.includes('rash') ||
    text.includes('itch') ||
    text.includes('eczema') ||
    text.includes('allergy') ||
    text.includes('urticaria') ||
    text.includes('spot') ||
    text.includes('blister')
  ) {
    return {
      specialty: 'Dermatology',
      rationale: 'Symptoms involve cutaneous or dermatological manifestations such as skin rash, pruritus, or lesions.',
    };
  }

  // 5. Orthopedics
  if (
    text.includes('bone') ||
    text.includes('joint') ||
    text.includes('knee') ||
    text.includes('back pain') ||
    text.includes('shoulder') ||
    text.includes('spine') ||
    text.includes('fracture') ||
    text.includes('sprain')
  ) {
    return {
      specialty: 'Orthopedics',
      rationale:
        'Reported concerns focus on musculoskeletal structures, joint mobility, or biomechanical back/joint discomfort.',
    };
  }

  // 6. Gastroenterology
  if (
    text.includes('stomach') ||
    text.includes('abdomen') ||
    text.includes('abdom') ||
    text.includes('acid') ||
    text.includes('reflux') ||
    text.includes('bowel') ||
    text.includes('digest') ||
    text.includes('nausea') ||
    text.includes('vomit')
  ) {
    return {
      specialty: 'Gastroenterology',
      rationale:
        'Symptoms center around gastrointestinal discomfort, digestion, or epigastric discomfort.',
    };
  }

  // 7. ENT
  if (
    text.includes('ear') ||
    text.includes('nose') ||
    text.includes('throat') ||
    text.includes('sinus') ||
    text.includes('tonsil') ||
    text.includes('hoarse')
  ) {
    return {
      specialty: 'ENT',
      rationale: 'Symptoms involve the otorhinolaryngological tract (ear, nasal passages, throat, or sinuses).',
    };
  }

  // Default: General Medicine
  return {
    specialty: 'General Medicine',
    rationale:
      'General constitutional or multisystem presentation suitable for an initial comprehensive primary care physician evaluation.',
  };
}

function generateNarrativeSummary(
  patient: PatientIntakeState,
  docs: DocumentFinding[],
  category: TriageCategory,
  specialty: string
): string {
  const parts: string[] = [];

  parts.push(
    `You reported experiencing ${patient.chiefConcern.toLowerCase() || 'health symptoms'}${
      patient.duration ? ` for approximately ${patient.duration}` : ''
    }.`
  );

  if (patient.severity !== null) {
    parts.push(
      `The reported symptom severity was rated at ${patient.severity}/10${
        patient.frequency ? `, following an ${patient.frequency} pattern` : ''
      }.`
    );
  }

  if (patient.associatedSymptoms.length > 0) {
    parts.push(`Associated symptoms mentioned include ${patient.associatedSymptoms.join(', ')}.`);
  }

  if (patient.activityAtOnset) {
    parts.push(`Onset was noted during or following: ${patient.activityAtOnset}.`);
  }

  if (docs.length > 0) {
    parts.push(
      `Additionally, ${docs.length} uploaded medical document${
        docs.length > 1 ? 's were' : ' was'
      } reviewed and integrated into this clinical overview.`
    );
  }

  parts.push(
    `Based on this structured intake, your AI-assisted triage indicator is calculated as ${category}, and consultation with a ${specialty} specialist is suggested for formal medical evaluation.`
  );

  return parts.join(' ');
}
