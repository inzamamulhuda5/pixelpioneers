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
  BOOKED_SLOTS: 'pixel_pioneers_booked_slots_v1',
};

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

// Generate realistic slots for a doctor across the next 5 days
export function generateDoctorSlots(doctorId: string, targetDateStr: string): AppointmentSlot[] {
  const bookedSet = getBookedSlotKeys();
  const reservedSet = getReservedSlotKeys();

  const timeTemplates = [
    { time: '09:00 AM', period: 'morning' as const },
    { time: '09:30 AM', period: 'morning' as const },
    { time: '10:15 AM', period: 'morning' as const },
    { time: '11:00 AM', period: 'morning' as const },
    { time: '11:45 AM', period: 'morning' as const },
    { time: '01:30 PM', period: 'afternoon' as const },
    { time: '02:15 PM', period: 'afternoon' as const },
    { time: '03:00 PM', period: 'afternoon' as const },
    { time: '04:30 PM', period: 'afternoon' as const },
    { time: '05:15 PM', period: 'evening' as const },
    { time: '06:00 PM', period: 'evening' as const },
    { time: '06:45 PM', period: 'evening' as const },
  ];

  return timeTemplates.map((t, idx) => {
    const slotId = `${doctorId}_${targetDateStr}_${idx}`;
    let status: 'available' | 'reserved' | 'booked' = 'available';

    if (bookedSet.has(slotId)) {
      status = 'booked';
    } else if (reservedSet.has(slotId)) {
      status = 'reserved';
    }

    return {
      id: slotId,
      doctorId,
      date: targetDateStr,
      time: t.time,
      period: t.period,
      status,
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

function getReservedSlotKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESERVED_SLOTS);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const active = new Set<string>();
    // Clean expired reservations (> 5 minutes)
    for (const [key, ts] of Object.entries(map)) {
      if (now - ts < 5 * 60 * 1000) {
        active.add(key);
      }
    }
    return active;
  } catch {
    return new Set();
  }
}

// Temporary slot reservation (Available -> Temporarily Reserved)
export function temporarilyReserveSlot(slotId: string): { success: boolean; message?: string } {
  const booked = getBookedSlotKeys();
  if (booked.has(slotId)) {
    return { success: false, message: 'This slot was just booked by another patient. Please choose another slot.' };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESERVED_SLOTS);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[slotId] = Date.now();
    localStorage.setItem(STORAGE_KEYS.RESERVED_SLOTS, JSON.stringify(map));
    return { success: true };
  } catch {
    return { success: true };
  }
}

// Release reservation
export function releaseReservation(slotId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESERVED_SLOTS);
    if (!raw) return;
    const map: Record<string, number> = JSON.parse(raw);
    delete map[slotId];
    localStorage.setItem(STORAGE_KEYS.RESERVED_SLOTS, JSON.stringify(map));
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

  // Mark slot as booked
  booked.add(slotId);
  localStorage.setItem(STORAGE_KEYS.BOOKED_SLOTS, JSON.stringify(Array.from(booked)));
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
    if (raw) return JSON.parse(raw);

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
