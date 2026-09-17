export type TriageCategory = 'LOW' | 'MODERATE' | 'HIGH' | 'URGENT';

export type IndicatorSource = 'conversation' | 'document' | 'profile' | 'clinical_rule';

export interface RiskIndicator {
  id: string;
  label: string;
  source: IndicatorSource;
  matched: boolean | null; // true: matched, false: not matched, null: information unavailable
  evidence: string;
  weight: 'low' | 'moderate' | 'high' | 'urgent';
  categoryNote?: string;
}

export interface SymptomDetail {
  id: string;
  name: string;
  duration?: string;
  severity?: number; // 1-10
  pattern?: string; // 'Constant' | 'Intermittent' | 'Gradual' | 'Sudden'
  triggers?: string[];
  notes?: string;
}

export interface DocumentFinding {
  id: string;
  fileName: string;
  fileType: string;
  fileSize?: string;
  uploadedAt: string;
  extractedTextSummary: string;
  medications?: string[];
  priorConditions?: string[];
  labFindings?: string[];
  suggestedSpecialty?: string;
  source: 'uploaded_report';
}

export interface PatientIntakeState {
  chiefConcern: string;
  symptoms: SymptomDetail[];
  duration: string | null;
  severity: number | null; // 1-10
  frequency: string | null; // 'constant' | 'intermittent' | 'fluctuating'
  triggers: string[];
  associatedSymptoms: string[];
  medicalHistory: string[];
  medications: string[];
  allergies: string[];
  lifestyleContext: string[];
  activityAtOnset?: string | null;
  age: number | null;
  sex: string | null;
  emergencyIndicators: string[];
  reportedDocuments: DocumentFinding[];
}

export interface AssessmentResult {
  id: string;
  createdAt: string;
  patientSummary: {
    chiefConcern: string;
    symptoms: SymptomDetail[];
    duration: string | null;
    severity: number | null;
    frequency: string | null;
    associatedSymptoms: string[];
    medicalHistory: string[];
    medications: string[];
    lifestyleContext: string[];
  };
  documentFindings: DocumentFinding[];
  aiSummaryText: string;
  recommendedSpecialty: string;
  specialtyRationale: string;
  triage: {
    category: TriageCategory;
    score: number; // 0 - 100
    explanation: string;
    indicators: RiskIndicator[];
    matchedCount: number;
    unmatchedCount: number;
    unknownCount: number;
    isEmergency: boolean;
    emergencyGuidance?: string;
  };
}

export type MetroCity =
  | 'Kolkata'
  | 'Delhi'
  | 'Mumbai'
  | 'Bengaluru'
  | 'Hyderabad'
  | 'Chennai'
  | 'Pune';

export type SpecialtyType =
  | 'General Medicine'
  | 'Cardiology'
  | 'Neurology'
  | 'Dermatology'
  | 'Orthopedics'
  | 'Gastroenterology'
  | 'ENT'
  | 'Pulmonology'
  | 'Pediatrics'
  | string;

export interface Clinic {
  id: string;
  name: string;
  city: MetroCity;
  area: string;
  address: string;
  specialties: string[];
  primarySpecialty?: string;
  consultationFeeRange: {
    min: number;
    max: number;
  };
  nextAvailableSlot: string;
  doctorCount: number;
  rating: number;
  phone: string;
  emergencyCareAvailable: boolean;
  emergencyCapable?: boolean;
  distanceKm?: number;
  description?: string;
  operatingHours?: string;
}

export interface Doctor {
  id: string;
  name: string;
  clinicId: string;
  clinicName: string;
  city: MetroCity;
  specialty: string;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  availableDays: string[];
  nextAvailableTime: string;
  nextAvailableSlot?: string;
  languages: string[];
  rating: number;
  reviewsCount: number;
  reviewCount?: number;
  about: string;
  avatarUrl?: string;
  badge?: string;
}

export type SlotPeriod = 'morning' | 'afternoon' | 'evening';

export interface AppointmentSlot {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "09:30 AM"
  period: SlotPeriod;
  status: 'available' | 'reserved' | 'booked';
  reservedAt?: number;
}

export type TimeSlot = AppointmentSlot;

export interface PricingBreakdown {
  baseFee: number;
  triageAdjustment: number;
  triageAdjustmentLabel: string;
  hospitalServiceFee: number;
  total: number;
  explanation: string;
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  patientAge?: number;
  clinic: Clinic;
  doctor: Doctor;
  date: string;
  time: string;
  slotId: string;
  specialty: string;
  pricing: PricingBreakdown;
  status: 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt?: string;
  cancellationReason?: string;
  previousSlot?: {
    date: string;
    time: string;
  };
  chiefConcern?: string;
  assessmentId?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isCompletePrompt?: boolean;
  quickReplies?: string[];
}

export interface DemoScenario {
  id: string;
  name: string;
  badge: string;
  shortDescription: string;
  chiefComplaint: string;
  sampleTranscript: { role: 'user' | 'assistant'; text: string }[];
  patientState: PatientIntakeState;
  intakeState?: PatientIntakeState;
  suggestedCity: MetroCity;
  city?: MetroCity;
  sampleDocument?: DocumentFinding;
  documentFindings?: DocumentFinding[];
}
