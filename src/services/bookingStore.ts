import {
  Appointment,
  AppointmentSlot,
  AssessmentResult,
  Clinic,
  Doctor,
  PricingBreakdown,
  TriageCategory,
} from '../types';
import { DOCTORS } from '../data/clinicsAndDoctors';

const STORAGE_KEYS = {
  APPOINTMENTS: 'pixel_pioneers_appointments_v1',
  ASSESSMENTS: 'pixel_pioneers_assessments_v1',
  RESERVED_SLOTS: 'pixel_pioneers_reserved_slots_v1',
  HELD_SLOTS: 'pixel_pioneers_held_slots_v2',
  BOOKED_SLOTS: 'pixel_pioneers_booked_slots_v1',
  CLIENT_SESSION: 'pixel_pioneers_client_session_v1',
};

// Unique client session ID to identify holds belonging to current user
export function getClientSessionId(): string {
  try {
    let sid = localStorage.getItem(STORAGE_KEYS.CLIENT_SESSION);
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      localStorage.setItem(STORAGE_KEYS.CLIENT_SESSION, sid);
    }
    return sid;
  } catch {
    return 'session_default';
  }
}

interface HeldSlotRecord {
  slotId: string;
  sessionId: string;
  heldAt: number;
  expiresAt: number;
  label?: string;
}

function getHeldSlotsMap(): Record<string, HeldSlotRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HELD_SLOTS);
    const map: Record<string, HeldSlotRecord> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const clean: Record<string, HeldSlotRecord> = {};
    for (const [k, v] of Object.entries(map)) {
      if (v && v.expiresAt > now) {
        clean[k] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

function saveHeldSlotsMap(map: Record<string, HeldSlotRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HELD_SLOTS, JSON.stringify(map));
  } catch {
    // Ignore storage issues
  }
}

// Pricing rule calculation
export function calculatePricing(
  doctor: Doctor,
  triageCategory: TriageCategory = 'LOW'
): PricingBreakdown {
  const baseFee = doctor.consultationFee;
  let triageAdjustment = 0;
  let triageAdjustmentLabel = 'Standard Intake Assessment';

  if (triageCategory === 'URGENT') {
    triageAdjustment = 150;
    triageAdjustmentLabel = 'Priority Clinical Intake & Same-Day Triage Access';
  } else if (triageCategory === 'HIGH') {
    triageAdjustment = 100;
    triageAdjustmentLabel = 'Expedited Clinical Coordination';
  } else if (triageCategory === 'MODERATE') {
    triageAdjustment = 50;
    triageAdjustmentLabel = 'Specialist Intake Review';
  } else {
    triageAdjustment = 0;
    triageAdjustmentLabel = 'Standard Intake Coordination (No additional fee)';
  }

  const hospitalServiceFee = 50; // Standard nominal clinic booking infrastructure fee
  const total = baseFee + triageAdjustment + hospitalServiceFee;

  return {
    baseFee,
    triageAdjustment,
    triageAdjustmentLabel,
    hospitalServiceFee,
    total,
    explanation:
      'Pricing is determined by the clinic: Base consultation (₹' +
      baseFee +
      ') + ' +
      triageAdjustmentLabel +
      ' (₹' +
      triageAdjustment +
      ') + Clinic administrative booking fee (₹' +
      hospitalServiceFee +
      '). No surge or hidden dynamic pricing is applied.',
  };
}

// Generate realistic slots for a doctor across the target date
export function generateDoctorSlots(doctorId: string, targetDateStr: string): AppointmentSlot[] {
  const bookedSet = getBookedSlotKeys();
  const heldMap = getHeldSlotsMap();
  const mySessionId = getClientSessionId();
  const now = Date.now();

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = targetDateStr === todayStr;
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  // Template times across Morning, Afternoon, and Evening
  // Evening explicitly features 06:00 PM, 06:30 PM, 07:00 PM, 07:30 PM
  const timeTemplates = [
    { time: '09:00 AM', period: 'morning' as const, hour: 9, min: 0 },
    { time: '09:30 AM', period: 'morning' as const, hour: 9, min: 30 },
    { time: '10:15 AM', period: 'morning' as const, hour: 10, min: 15 },
    { time: '11:00 AM', period: 'morning' as const, hour: 11, min: 0 },
    { time: '11:45 AM', period: 'morning' as const, hour: 11, min: 45 },
    { time: '02:00 PM', period: 'afternoon' as const, hour: 14, min: 0 },
    { time: '02:45 PM', period: 'afternoon' as const, hour: 14, min: 45 },
    { time: '03:30 PM', period: 'afternoon' as const, hour: 15, min: 30 },
    { time: '04:15 PM', period: 'afternoon' as const, hour: 16, min: 15 },
    { time: '05:00 PM', period: 'evening' as const, hour: 17, min: 0 },
    { time: '06:00 PM', period: 'evening' as const, hour: 18, min: 0 },
    { time: '06:30 PM', period: 'evening' as const, hour: 18, min: 30 },
    { time: '07:00 PM', period: 'evening' as const, hour: 19, min: 0 },
    { time: '07:30 PM', period: 'evening' as const, hour: 19, min: 30 },
    { time: '08:00 PM', period: 'evening' as const, hour: 20, min: 0 },
  ];

  return timeTemplates.map((t, idx) => {
    const slotId = `${doctorId}_${targetDateStr}_${idx}`;
    let status: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNAVAILABLE' | 'EXPIRED' = 'AVAILABLE';
    let heldUntil: number | undefined;
    let heldByMe = false;
    let heldByLabel: string | undefined;
    let unavailableReason: string | undefined;

    // Check if slot has expired in past hours of today
    if (isToday && (t.hour < currentHour || (t.hour === currentHour && t.min < currentMinute - 10))) {
      status = 'EXPIRED';
    } else if (bookedSet.has(slotId)) {
      status = 'BOOKED';
    } else if (heldMap[slotId] && heldMap[slotId].expiresAt > now) {
      status = 'HELD';
      heldUntil = heldMap[slotId].expiresAt;
      if (heldMap[slotId].sessionId === mySessionId) {
        heldByMe = true;
        heldByLabel = 'Held for you';
      } else {
        heldByMe = false;
        heldByLabel = 'Held by patient';
      }
    } else {
      // Deterministic clinic simulation for authenticity:
      // Doctor on inpatient OT rounds at 03:30 PM (idx 7)
      if (idx === 7) {
        status = 'UNAVAILABLE';
        unavailableReason = 'Inpatient OT / Hospital Rounds';
      } else if (idx === 12) {
        // 07:00 PM Booked by another clinic patient
        status = 'BOOKED';
      } else if (idx === 11) {
        // 06:30 PM Held by another patient at clinic registration desk
        status = 'HELD';
        heldUntil = now + 180 * 1000; // 3 min remaining
        heldByMe = false;
        heldByLabel = 'Held by patient';
      } else if (idx === 2) {
        // 10:15 AM Booked
        status = 'BOOKED';
      } else {
        status = 'AVAILABLE';
      }
    }

    return {
      id: slotId,
      doctorId,
      date: targetDateStr,
      time: t.time,
      period: t.period,
      status,
      heldUntil,
      heldByMe,
      heldByLabel,
      unavailableReason,
    };
  });
}

function getBookedSlotKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKED_SLOTS);
    return new Set(raw ? JSON.parse(raw) : ['doc-card-1_today_1', 'doc-neuro-1_today_4']);
  } catch {
    return new Set();
  }
}

// Temporarily hold a slot (e.g. 5 minutes countdown)
export function temporarilyReserveSlot(
  slotId: string,
  durationSeconds: number = 300
): { success: boolean; heldUntil?: number; message?: string } {
  const booked = getBookedSlotKeys();
  if (booked.has(slotId)) {
    return {
      success: false,
      message: 'This slot was just booked by another patient. Please choose an available slot.',
    };
  }

  const heldMap = getHeldSlotsMap();
  const mySessionId = getClientSessionId();
  const existing = heldMap[slotId];

  if (existing && existing.expiresAt > Date.now() && existing.sessionId !== mySessionId) {
    return {
      success: false,
      message: 'This slot is currently held by another patient. Please choose another available slot.',
    };
  }

  // Release any other slot previously held by THIS session so only 1 slot is held at a time
  for (const [k, v] of Object.entries(heldMap)) {
    if (v.sessionId === mySessionId && k !== slotId) {
      delete heldMap[k];
    }
  }

  const expiresAt = Date.now() + durationSeconds * 1000;
  heldMap[slotId] = {
    slotId,
    sessionId: mySessionId,
    heldAt: Date.now(),
    expiresAt,
    label: 'Held for you',
  };

  saveHeldSlotsMap(heldMap);
  return { success: true, heldUntil: expiresAt };
}

// Release a temporary hold
export function releaseReservation(slotId?: string): void {
  try {
    const heldMap = getHeldSlotsMap();
    const mySessionId = getClientSessionId();
    if (slotId) {
      if (heldMap[slotId]?.sessionId === mySessionId) {
        delete heldMap[slotId];
        saveHeldSlotsMap(heldMap);
      }
    } else {
      for (const [k, v] of Object.entries(heldMap)) {
        if (v.sessionId === mySessionId) {
          delete heldMap[k];
        }
      }
      saveHeldSlotsMap(heldMap);
    }
  } catch {
    // Ignore
  }
}

// Confirm booking
export function confirmBooking(
  slotId: string,
  appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'status'>
): { success: boolean; appointment?: Appointment; error?: string } {
  const booked = getBookedSlotKeys();
  if (booked.has(slotId)) {
    return {
      success: false,
      error: 'This slot is no longer available. Another patient just completed booking this time.',
    };
  }

  // Mark slot as permanently booked
  booked.add(slotId);
  localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));

  // Release the temporary hold
  releaseReservation(slotId);

  const appointment: Appointment = {
    ...appointmentData,
    id: 'PX-' + Math.floor(100000 + Math.random() * 900000),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  const existing = getAllAppointments();
  existing.unshift(appointment);
  localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(existing));

  return { success: true, appointment };
}

export function getAllAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (raw) {
      const appointments: Appointment[] = JSON.parse(raw);
      return appointments.map((appt) => {
        if (!appt.doctor?.avatarUrl && appt.doctor?.id) {
          const match = DOCTORS.find((d) => d.id === appt.doctor.id);
          return {
            ...appt,
            doctor: {
              ...appt.doctor,
              avatarUrl: match?.avatarUrl || `/doctors/${appt.doctor.id}.jpg`,
            },
          };
        }
        return appt;
      });
    }

    // Initial default demo appointment for immediate rich UI testing
    const defaultAppointment: Appointment = {
      id: 'PX-849201',
      patientName: 'Demo Patient',
      patientPhone: '+91 98301 23456',
      patientEmail: 'patient.demo@pixelpioneers.health',
      patientAge: 42,
      clinic: {
        id: 'kol-1',
        name: 'Pixel Health Specialty Clinic',
        city: 'Kolkata',
        area: 'Salt Lake Sector V',
        address: 'Plot 12, EP Block, Sector V, Bidhannagar, Kolkata 700091',
        specialties: ['General Medicine', 'Cardiology', 'Neurology', 'Dermatology'],
        consultationFeeRange: { min: 500, max: 900 },
        nextAvailableSlot: 'Today, 04:30 PM',
        doctorCount: 6,
        rating: 4.8,
        phone: '+91 33 2357 4100',
        emergencyCareAvailable: false,
      },
      doctor: DOCTORS[0], // Dr. Vikram Sen
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: '04:30 PM',
      slotId: 'doc-card-1_sample_1',
      specialty: 'Cardiology',
      pricing: {
        baseFee: 800,
        triageAdjustment: 100,
        triageAdjustmentLabel: 'Expedited Clinical Coordination',
        hospitalServiceFee: 50,
        total: 950,
        explanation: 'Transparent clinic-configured consultation pricing.',
      },
      status: 'confirmed',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      chiefConcern: 'Chest tightness evaluation',
    };

    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify([defaultAppointment]));
    return [defaultAppointment];
  } catch {
    return [];
  }
}

export function cancelAppointment(appointmentId: string, reason: string): boolean {
  try {
    const appointments = getAllAppointments();
    const target = appointments.find((a) => a.id === appointmentId);
    if (!target) return false;

    target.status = 'cancelled';
    target.cancellationReason = reason || 'Patient requested cancellation';
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));

    // Release the booked slot
    const booked = getBookedSlotKeys();
    booked.delete(target.slotId);
    localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));

    return true;
  } catch {
    return false;
  }
}

export function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime: string,
  newSlotId: string
): { success: boolean; error?: string } {
  try {
    const appointments = getAllAppointments();
    const target = appointments.find((a) => a.id === appointmentId);
    if (!target) return { success: false, error: 'Appointment not found.' };

    const booked = getBookedSlotKeys();
    if (booked.has(newSlotId)) {
      return { success: false, error: 'The selected slot has just been taken.' };
    }

    // Release previous slot
    booked.delete(target.slotId);
    // Take new slot
    booked.add(newSlotId);
    localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));

    target.previousSlot = {
      date: target.date,
      time: target.time,
    };
    target.date = newDate;
    target.time = newTime;
    target.slotId = newSlotId;
    target.status = 'rescheduled';

    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Assessment history persistence
export function saveAssessmentToHistory(assessment: AssessmentResult): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    const list: AssessmentResult[] = raw ? JSON.parse(raw) : [];
    list.unshift(assessment);
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(list.slice(0, 20)));
  } catch {
    // Ignore
  }
}

export function getAssessmentHistory(): AssessmentResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Simulation helpers for testing
export function simulateSlotContention(slotId: string): void {
  const booked = getBookedSlotKeys();
  booked.add(slotId);
  localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));
}

export function resetDemoBookings(): void {
  localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
  localStorage.removeItem(STORAGE_KEYS.BOOKED_SLOTS);
  localStorage.removeItem(STORAGE_KEYS.RESERVED_SLOTS);
}

// Next 7 days formatted as YYYY-MM-DD
export function getAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getTimeSlotsForDate(
  doctorId: string,
  _clinicId: string,
  dateStr: string
): import('../types').TimeSlot[] {
  return generateDoctorSlots(doctorId, dateStr);
}

export function calculatePricingBreakdown(
  baseFee: number,
  triageCategory: TriageCategory = 'LOW'
): PricingBreakdown {
  return calculatePricing({ consultationFee: baseFee } as Doctor, triageCategory);
}

export function reserveSlotTemporary(slotId: string): { success: boolean; message?: string } {
  return temporarilyReserveSlot(slotId);
}

export function bookAppointment(params: {
  doctor: Doctor;
  clinic: Clinic;
  specialty: string;
  date: string;
  time: string;
  slotId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  patientAge: number;
  chiefConcern?: string;
  triageCategory: TriageCategory;
}): Appointment {
  const pricing = calculatePricing(params.doctor, params.triageCategory);
  const result = confirmBooking(params.slotId, {
    patientName: params.patientName,
    patientPhone: params.patientPhone,
    patientEmail: params.patientEmail,
    patientAge: params.patientAge,
    clinic: params.clinic,
    doctor: params.doctor,
    date: params.date,
    time: params.time,
    slotId: params.slotId,
    specialty: params.specialty,
    pricing,
    chiefConcern: params.chiefConcern,
  });

  if (!result.success || !result.appointment) {
    throw new Error(result.error || 'Failed to book slot');
  }

  return result.appointment;
}

export function simulateSlotConflict(slotId?: string): void {
  const target = slotId || 'doc-card-1_' + new Date().toISOString().split('T')[0] + '_0';
  simulateSlotContention(target);
}
