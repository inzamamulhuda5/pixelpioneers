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

export interface ServerHeldSlotInfo {
  slotId: string;
  doctorId: string;
  date: string;
  time: string;
  expiresAt: number;
  heldByMe: boolean;
  label: string;
}

export interface GlobalSlotState {
  heldSlots: Record<string, ServerHeldSlotInfo>;
  bookedSlots: string[];
  serverTime: number;
}

// In-memory global slot availability cache
let globalSlotCache: GlobalSlotState = {
  heldSlots: {},
  bookedSlots: ['doc-card-1_today_1', 'doc-neuro-1_today_4'],
  serverTime: Date.now(),
};

// Fetch latest global slot availability from the backend server
export async function fetchServerSlotAvailability(
  doctorId?: string,
  date?: string
): Promise<GlobalSlotState> {
  const sessionId = getClientSessionId();
  try {
    const params = new URLSearchParams();
    if (doctorId) params.append('doctorId', doctorId);
    if (date) params.append('date', date);
    params.append('sessionId', sessionId);

    const res = await fetch(`/api/slots/availability?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        globalSlotCache = {
          heldSlots: data.heldSlots || {},
          bookedSlots: Array.isArray(data.bookedSlots) ? data.bookedSlots : [],
          serverTime: data.serverTime || Date.now(),
        };
        try {
          localStorage.setItem(STORAGE_KEYS.HELD_SLOTS, JSON.stringify(globalSlotCache.heldSlots));
          localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(globalSlotCache.bookedSlots));
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Network fallback
  }
  return globalSlotCache;
}

// Subscribe to real-time slot updates across devices via SSE and fast polling
export function subscribeToSlotUpdates(
  doctorId: string,
  date: string,
  onUpdate: () => void
): () => void {
  let isSubscribed = true;
  let eventSource: EventSource | null = null;

  // 1. SSE Connection for instant push
  try {
    eventSource = new EventSource('/api/slots/stream');
    eventSource.onmessage = async (evt) => {
      if (!isSubscribed) return;
      try {
        const payload = JSON.parse(evt.data);
        if (
          payload.type === 'SLOT_HELD' ||
          payload.type === 'SLOT_RELEASED' ||
          payload.type === 'SLOT_BOOKED' ||
          payload.type === 'HOLDS_EXPIRED' ||
          payload.type === 'CONNECTED'
        ) {
          await fetchServerSlotAvailability(doctorId, date);
          if (isSubscribed) {
            onUpdate();
          }
        }
      } catch {
        // Fallback
      }
    };
  } catch {
    // EventSource fallback
  }

  // 2. Guaranteed Fast Polling interval (1.5 seconds)
  const intervalId = setInterval(async () => {
    if (!isSubscribed) return;
    await fetchServerSlotAvailability(doctorId, date);
    if (isSubscribed) {
      onUpdate();
    }
  }, 1500);

  return () => {
    isSubscribed = false;
    if (eventSource) {
      eventSource.close();
    }
    clearInterval(intervalId);
  };
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
  const mySessionId = getClientSessionId();
  const now = Date.now();

  const bookedSet = new Set([
    ...globalSlotCache.bookedSlots,
    ...Array.from(getBookedSlotKeys()),
  ]);

  const heldMap = {
    ...getHeldSlotsMap(),
    ...globalSlotCache.heldSlots,
  };

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

    const serverHold = globalSlotCache.heldSlots[slotId];

    // Check if slot has expired in past hours of today
    if (isToday && (t.hour < currentHour || (t.hour === currentHour && t.min < currentMinute - 10))) {
      status = 'EXPIRED';
    } else if (bookedSet.has(slotId)) {
      status = 'BOOKED';
    } else if (serverHold && serverHold.expiresAt > now) {
      status = 'HELD';
      heldUntil = serverHold.expiresAt;
      heldByMe = Boolean(serverHold.heldByMe);
      heldByLabel = serverHold.label || (heldByMe ? 'Held for you' : 'Held by patient');
    } else if (heldMap[slotId] && heldMap[slotId].expiresAt > now) {
      status = 'HELD';
      heldUntil = heldMap[slotId].expiresAt;
      const localHold = heldMap[slotId] as any;
      const isMine =
        localHold?.sessionId === mySessionId || localHold?.heldByMe === true;
      heldByMe = isMine;
      heldByLabel = isMine ? 'Held for you' : 'Held by patient';
    } else {
      // Deterministic clinic simulation for authenticity:
      // Doctor on inpatient OT rounds at 03:30 PM (idx 7)
      if (idx === 7) {
        status = 'UNAVAILABLE';
        unavailableReason = 'Inpatient OT / Hospital Rounds';
      } else if (idx === 12) {
        // 07:00 PM Booked by another clinic patient
        status = 'BOOKED';
      } else if (idx === 2) {
        // 10:15 AM Booked
        status = 'BOOKED';
      } else {
        // Dynamic slots (including 06:30 PM) are available unless held across devices
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

// Temporarily hold a slot across all devices (e.g. 5 minutes countdown)
export async function temporarilyReserveSlot(
  slotId: string,
  durationSeconds: number = 300,
  slotDetails?: { doctorId?: string; date?: string; time?: string }
): Promise<{ success: boolean; heldUntil?: number; message?: string }> {
  const mySessionId = getClientSessionId();

  // Check locally booked first
  const booked = getBookedSlotKeys();
  if (booked.has(slotId) || globalSlotCache.bookedSlots.includes(slotId)) {
    return {
      success: false,
      message: 'This slot was just booked by another patient. Please choose an available slot.',
    };
  }

  try {
    const res = await fetch('/api/slots/hold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        doctorId: slotDetails?.doctorId,
        date: slotDetails?.date,
        time: slotDetails?.time,
        sessionId: mySessionId,
        durationSeconds,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        message:
          data.message ||
          'This slot is currently held by another patient. Please choose another available slot.',
      };
    }

    const expiresAt = data.heldUntil || Date.now() + durationSeconds * 1000;

    // Update global memory cache immediately
    globalSlotCache.heldSlots[slotId] = {
      slotId,
      doctorId: slotDetails?.doctorId || '',
      date: slotDetails?.date || '',
      time: slotDetails?.time || '',
      expiresAt,
      heldByMe: true,
      label: 'Held for you',
    };

    // Release any other slot previously held by THIS user
    for (const [id, h] of Object.entries(globalSlotCache.heldSlots)) {
      if (h.heldByMe && id !== slotId) {
        delete globalSlotCache.heldSlots[id];
      }
    }

    // Mirror to local storage
    const heldMap = getHeldSlotsMap();
    for (const [k, v] of Object.entries(heldMap)) {
      if (v.sessionId === mySessionId && k !== slotId) {
        delete heldMap[k];
      }
    }
    heldMap[slotId] = {
      slotId,
      sessionId: mySessionId,
      heldAt: Date.now(),
      expiresAt,
      label: 'Held for you',
    };
    saveHeldSlotsMap(heldMap);

    return { success: true, heldUntil: expiresAt };
  } catch {
    // Graceful offline fallback
    const expiresAt = Date.now() + durationSeconds * 1000;
    const heldMap = getHeldSlotsMap();
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
}

// Release a temporary hold across all devices
export async function releaseReservation(slotId?: string): Promise<void> {
  const mySessionId = getClientSessionId();
  try {
    fetch('/api/slots/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, sessionId: mySessionId }),
    }).catch(() => {});
  } catch {
    // Ignore
  }

  if (slotId) {
    delete globalSlotCache.heldSlots[slotId];
  } else {
    for (const [id, h] of Object.entries(globalSlotCache.heldSlots)) {
      if (h.heldByMe) {
        delete globalSlotCache.heldSlots[id];
      }
    }
  }

  try {
    const heldMap = getHeldSlotsMap();
    if (slotId) {
      delete heldMap[slotId];
    } else {
      for (const [k, v] of Object.entries(heldMap)) {
        if (v.sessionId === mySessionId) {
          delete heldMap[k];
        }
      }
    }
    saveHeldSlotsMap(heldMap);
  } catch {
    // Ignore
  }
}

// Confirm booking across all devices
export async function confirmBooking(
  slotId: string,
  appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'status'>
): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
  const booked = getBookedSlotKeys();
  if (booked.has(slotId) || globalSlotCache.bookedSlots.includes(slotId)) {
    return {
      success: false,
      error: 'This slot is no longer available. Another patient just completed booking this time.',
    };
  }

  const mySessionId = getClientSessionId();
  const appointment: Appointment = {
    ...appointmentData,
    id: 'PX-' + Math.floor(100000 + Math.random() * 900000),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/slots/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        doctorId: appointmentData.doctor?.id,
        date: appointmentData.date,
        time: appointmentData.time,
        sessionId: mySessionId,
        appointment,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error:
          data.message ||
          'This slot is no longer available. Another patient just completed booking this time.',
      };
    }
  } catch {
    // Network fallback
  }

  // Mark slot as permanently booked locally
  booked.add(slotId);
  localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));
  globalSlotCache.bookedSlots.push(slotId);
  delete globalSlotCache.heldSlots[slotId];

  // Release local hold
  releaseReservation(slotId);

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
    globalSlotCache.bookedSlots = globalSlotCache.bookedSlots.filter((id) => id !== target.slotId);

    fetch('/api/slots/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: target.slotId }),
    }).catch(() => {});

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
    if (booked.has(newSlotId) || globalSlotCache.bookedSlots.includes(newSlotId)) {
      return { success: false, error: 'The selected slot has just been taken.' };
    }

    // Release previous slot
    booked.delete(target.slotId);
    globalSlotCache.bookedSlots = globalSlotCache.bookedSlots.filter((id) => id !== target.slotId);
    fetch('/api/slots/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: target.slotId }),
    }).catch(() => {});

    // Take new slot
    booked.add(newSlotId);
    globalSlotCache.bookedSlots.push(newSlotId);
    localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));

    fetch('/api/slots/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId: newSlotId,
        doctorId: target.doctor?.id,
        date: newDate,
        time: newTime,
        sessionId: getClientSessionId(),
      }),
    }).catch(() => {});

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

export async function fetchTimeSlotsForDate(
  doctorId: string,
  _clinicId: string,
  dateStr: string
): Promise<import('../types').TimeSlot[]> {
  await fetchServerSlotAvailability(doctorId, dateStr);
  return generateDoctorSlots(doctorId, dateStr);
}

export function calculatePricingBreakdown(
  baseFee: number,
  triageCategory: TriageCategory = 'LOW'
): PricingBreakdown {
  return calculatePricing({ consultationFee: baseFee } as Doctor, triageCategory);
}

export async function reserveSlotTemporary(
  slotId: string,
  slotDetails?: { doctorId?: string; date?: string; time?: string }
): Promise<{ success: boolean; message?: string }> {
  return temporarilyReserveSlot(slotId, 300, slotDetails);
}

export async function bookAppointment(params: {
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
}): Promise<Appointment> {
  const pricing = calculatePricing(params.doctor, params.triageCategory);
  const result = await confirmBooking(params.slotId, {
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
