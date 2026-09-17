import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Shield,
  Stethoscope,
  User,
  X,
  ArrowRight,
  ArrowLeft,
  Info,
} from 'lucide-react';
import {
  Appointment,
  Clinic,
  Doctor,
  TimeSlot,
  TriageCategory,
} from '../../types';
import {
  bookAppointment,
  calculatePricingBreakdown,
  getAvailableDates,
  getTimeSlotsForDate,
  temporarilyReserveSlot,
  releaseReservation,
} from '../../services/bookingStore';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor;
  clinic: Clinic;
  patientChiefConcern?: string;
  triageCategory?: TriageCategory;
  onBookingSuccess: (appointment: Appointment) => void;
}

type BookingStep = 'slots' | 'patient' | 'review';

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  doctor,
  clinic,
  patientChiefConcern = '',
  triageCategory = 'LOW',
  onBookingSuccess,
}) => {
  const dates = getAvailableDates();
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Active step state
  const [currentStep, setCurrentStep] = useState<BookingStep>('slots');

  // Live countdown for held slot (5 minutes = 300s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [isHoldActive, setIsHoldActive] = useState<boolean>(false);

  // Patient details state
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientAge, setPatientAge] = useState('32');
  const [concern, setConcern] = useState(patientChiefConcern);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Transparent pricing calculation based on assessment triage
  const pricing = calculatePricingBreakdown(doctor.consultationFee, triageCategory);

  // Load slots when date or doctor changes
  const refreshSlots = () => {
    const currentSlots = getTimeSlotsForDate(doctor.id, clinic.id, selectedDate);
    setSlots(currentSlots);
    return currentSlots;
  };

  useEffect(() => {
    if (!isOpen) return;
    const currentSlots = refreshSlots();

    // Auto-select first available slot if none selected yet
    if (!selectedSlot) {
      const firstAvailable = currentSlots.find((s) => s.status.toUpperCase() === 'AVAILABLE');
      if (firstAvailable) {
        handleSelectSlot(firstAvailable);
      }
    }
  }, [isOpen, selectedDate, doctor.id, clinic.id]);

  // Keep concern updated if triage assessment updates
  useEffect(() => {
    if (patientChiefConcern && !concern) {
      setConcern(patientChiefConcern);
    }
  }, [patientChiefConcern]);

  // Active 1-second interval timer for the held slot countdown
  useEffect(() => {
    if (!isHoldActive || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsHoldActive(false);
          setBookingError(
            'Your 5-minute temporary hold has expired. Please select an available slot to continue.'
          );
          refreshSlots();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isHoldActive, secondsRemaining]);

  // Clean up hold when closing modal
  const handleClose = () => {
    if (selectedSlot) {
      releaseReservation(selectedSlot.id);
    }
    setIsHoldActive(false);
    setSelectedSlot(null);
    setCurrentStep('slots');
    onClose();
  };

  if (!isOpen) return null;

  // Format seconds to mm:ss
  const formatCountdown = (totalSecs: number): string => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Slot selection handler: transitions slot to HELD
  const handleSelectSlot = (slot: TimeSlot) => {
    const statusUpper = slot.status.toUpperCase();
    if (statusUpper !== 'AVAILABLE' && !slot.heldByMe) return;

    const res = temporarilyReserveSlot(slot.id, 300);
    if (!res.success) {
      setBookingError(res.message || 'Slot could not be held. Please choose another.');
      refreshSlots();
      return;
    }

    setSelectedSlot(slot);
    setSecondsRemaining(300);
    setIsHoldActive(true);
    setBookingError(null);
    refreshSlots();
  };

  // Step 2 Form Validation
  const validatePatientForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!patientName.trim()) errs.name = 'Patient full name is required';
    if (!patientPhone.trim() || patientPhone.replace(/\D/g, '').length < 10) {
      errs.phone = 'Valid 10-digit phone number is required';
    }
    if (!patientEmail.trim() || !patientEmail.includes('@')) {
      errs.email = 'Valid email is required';
    }
    if (!patientAge || parseInt(patientAge, 10) < 1) {
      errs.age = 'Age is required';
    }
    if (!selectedSlot) {
      errs.slot = 'Please select and hold an available time slot';
    } else if (secondsRemaining <= 0) {
      errs.slot = 'Your temporary hold on this slot expired. Please select a new slot.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Proceed to Step 2
  const handleProceedToPatientDetails = () => {
    if (!selectedSlot) {
      setBookingError('Please select an available time slot to hold.');
      return;
    }
    if (secondsRemaining <= 0) {
      setBookingError('Your hold has expired. Please select an available slot.');
      return;
    }
    setBookingError(null);
    setCurrentStep('patient');
  };

  // Proceed to Step 3
  const handleProceedToReview = () => {
    if (!validatePatientForm()) return;
    setBookingError(null);
    setCurrentStep('review');
  };

  // Confirm booking handler
  const handleConfirmBooking = async () => {
    if (!validatePatientForm()) return;
    if (!selectedSlot) return;

    if (secondsRemaining <= 0) {
      setBookingError('Your temporary hold has expired. Please select an available slot.');
      setCurrentStep('slots');
      return;
    }

    setIsSubmitting(true);
    setBookingError(null);

    try {
      const newAppointment = bookAppointment({
        doctor,
        clinic,
        specialty: doctor.specialty,
        date: selectedDate,
        time: selectedSlot.time,
        slotId: selectedSlot.id,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientEmail: patientEmail.trim(),
        patientAge: parseInt(patientAge, 10),
        chiefConcern: concern.trim() || patientChiefConcern || undefined,
        triageCategory,
      });

      setIsHoldActive(false);
      onBookingSuccess(newAppointment);
    } catch (err: any) {
      setBookingError(
        err.message || 'This slot was just taken by another patient. Please select a different time slot.'
      );
      setCurrentStep('slots');
      refreshSlots();
      setSelectedSlot(null);
      setIsHoldActive(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group slots by period
  const morningSlots = slots.filter((s) => s.period === 'morning');
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon');
  const eveningSlots = slots.filter((s) => s.period === 'evening');

  // Helper to render individual slot with real status
  const renderSlotItem = (slot: TimeSlot) => {
    const statusUpper = slot.status.toUpperCase();
    const isSelected = selectedSlot?.id === slot.id;
    const isHeldByMe = slot.heldByMe || (isSelected && isHoldActive);

    if (isHeldByMe) {
      return (
        <div
          key={slot.id}
          className="flex items-center justify-between rounded-xl border-2 border-teal-600 bg-teal-50 px-3 py-2 text-xs shadow-xs font-bold text-teal-950 transition"
        >
          <div className="flex items-center gap-1.5 font-bold text-zinc-900">
            <Clock className="h-3.5 w-3.5 text-teal-600" />
            <span>{slot.time}</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Held ({formatCountdown(secondsRemaining)})
          </span>
        </div>
      );
    }

    if (statusUpper === 'HELD') {
      return (
        <div
          key={slot.id}
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 cursor-not-allowed opacity-85"
          title="This slot is currently held by another patient"
        >
          <div className="flex items-center gap-1.5 font-semibold text-zinc-700">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>{slot.time}</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Held
          </span>
        </div>
      );
    }

    if (statusUpper === 'BOOKED') {
      return (
        <div
          key={slot.id}
          className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100/90 px-3 py-2 text-xs text-zinc-400 cursor-not-allowed opacity-65"
          title="Slot already booked by a patient"
        >
          <span className="line-through font-medium">{slot.time}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
            Booked
          </span>
        </div>
      );
    }

    if (statusUpper === 'UNAVAILABLE') {
      return (
        <div
          key={slot.id}
          className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100/90 px-3 py-2 text-xs text-zinc-400 cursor-not-allowed opacity-65"
          title={slot.unavailableReason || 'Unavailable for consultation'}
        >
          <span className="font-medium text-zinc-500">{slot.time}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
            Unavailable
          </span>
        </div>
      );
    }

    if (statusUpper === 'EXPIRED') {
      return (
        <div
          key={slot.id}
          className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-400 cursor-not-allowed opacity-50"
          title="Slot time has already elapsed"
        >
          <span className="line-through">{slot.time}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
            Expired
          </span>
        </div>
      );
    }

    // Default: AVAILABLE
    return (
      <button
        key={slot.id}
        type="button"
        onClick={() => handleSelectSlot(slot)}
        className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold transition hover:border-teal-500 hover:bg-teal-50/50 hover:shadow-xs active:scale-98 cursor-pointer text-left"
      >
        <div className="flex items-center gap-1.5 font-bold text-zinc-900">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          <span>{slot.time}</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Available
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-zinc-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-2xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 font-['Space_Grotesk']">
                Schedule Doctor Consultation
              </h2>
              <p className="text-xs text-zinc-500">
                Clinic Desk Synchronization &bull; Real-Time Slot Holding
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Guided Step Progress Bar */}
        <div className="mt-4 flex items-center justify-between border-b border-zinc-100 pb-3 text-xs">
          <button
            type="button"
            onClick={() => setCurrentStep('slots')}
            className={`flex items-center gap-1.5 font-bold transition ${
              currentStep === 'slots'
                ? 'text-teal-700'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                currentStep === 'slots' ? 'bg-teal-600 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              1
            </span>
            <span>1. Select & Hold Slot</span>
          </button>

          <span className="text-zinc-300">&bull;&bull;&bull;</span>

          <button
            type="button"
            onClick={() => {
              if (selectedSlot && isHoldActive) setCurrentStep('patient');
            }}
            disabled={!selectedSlot || !isHoldActive}
            className={`flex items-center gap-1.5 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
              currentStep === 'patient'
                ? 'text-teal-700'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                currentStep === 'patient' ? 'bg-teal-600 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              2
            </span>
            <span>2. Patient Details</span>
          </button>

          <span className="text-zinc-300">&bull;&bull;&bull;</span>

          <button
            type="button"
            onClick={() => {
              if (selectedSlot && isHoldActive && validatePatientForm()) setCurrentStep('review');
            }}
            disabled={!selectedSlot || !isHoldActive}
            className={`flex items-center gap-1.5 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
              currentStep === 'review'
                ? 'text-teal-700'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                currentStep === 'review' ? 'bg-teal-600 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              3
            </span>
            <span>3. Review & Pricing</span>
          </button>
        </div>

        {/* Doctor & Clinic Summary Bar */}
        <div className="mt-3.5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <img
              src={doctor.avatarUrl || `/doctors/${doctor.id}.jpg`}
              alt={doctor.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-xl object-cover border border-zinc-200 shrink-0 aspect-square"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 text-sm">{doctor.name}</span>
                <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-800">
                  {doctor.specialty}
                </span>
              </div>
              <p className="text-zinc-500 mt-0.5">
                {clinic.name} &bull; {clinic.area}, {clinic.city}
              </p>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-zinc-200 sm:pl-4">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Consultation Fee</span>
            <span className="text-sm font-bold text-teal-700">INR {doctor.consultationFee}.00</span>
          </div>
        </div>

        {/* Error Alert */}
        {bookingError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{bookingError}</span>
          </div>
        )}

        {/* TEMPORARILY HELD ACTIVE ALERT BANNER */}
        {isHoldActive && selectedSlot && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 border border-teal-300 p-2.5 text-xs text-teal-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-teal-600 animate-ping" />
              <span>
                <strong>Slot Temporarily Held:</strong> {selectedSlot.time} on {selectedDate}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono font-bold text-teal-800 bg-white border border-teal-200 rounded px-2 py-0.5">
              <Clock className="h-3 w-3 text-teal-600" />
              <span>{formatCountdown(secondsRemaining)} remaining</span>
            </div>
          </div>
        )}

        {/* ================= STEP 1: AVAILABLE DATES & TIME SLOTS ================= */}
        {currentStep === 'slots' && (
          <div className="mt-4 space-y-4">
            {/* Available Dates */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Available Dates
                </span>
                <span className="text-[11px] text-zinc-400">Next 7 calendar days</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {dates.map((d, idx) => {
                  const isSelected = selectedDate === d;
                  const dateObj = new Date(d);
                  const dayName =
                    idx === 0
                      ? 'Today'
                      : idx === 1
                      ? 'Tomorrow'
                      : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const monthDay = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d);
                        setBookingError(null);
                      }}
                      className={`flex flex-col items-center justify-center rounded-xl border px-3.5 py-2 text-center transition cursor-pointer min-w-[76px] ${
                        isSelected
                          ? 'border-teal-600 bg-teal-600 text-white shadow-xs font-bold'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <span
                        className={`text-[10px] uppercase font-bold ${
                          isSelected ? 'text-teal-100' : 'text-zinc-400'
                        }`}
                      >
                        {dayName}
                      </span>
                      <span className="text-xs font-bold mt-0.5">{monthDay}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available Time Slots with Real Booking States */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  Available Time Slots
                </span>

                {/* State Legend */}
                <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Available
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Held
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-zinc-400" /> Booked
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-zinc-300" /> Unavailable
                  </span>
                </div>
              </div>

              {/* Slots Container */}
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {/* Morning Slots */}
                {morningSlots.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Morning (09:00 AM - 12:00 PM)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {morningSlots.map((s) => renderSlotItem(s))}
                    </div>
                  </div>
                )}

                {/* Afternoon Slots */}
                {afternoonSlots.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Afternoon (02:00 PM - 05:00 PM)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {afternoonSlots.map((s) => renderSlotItem(s))}
                    </div>
                  </div>
                )}

                {/* Evening Slots (Includes 06:00 PM, 06:30 PM, 07:00 PM, 07:30 PM) */}
                {eveningSlots.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Evening (05:00 PM - 08:30 PM)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {eveningSlots.map((s) => renderSlotItem(s))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 Footer Action */}
            <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3.5">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!selectedSlot || !isHoldActive || secondsRemaining <= 0}
                onClick={handleProceedToPatientDetails}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer active:scale-98"
              >
                <span>Proceed to Patient Details</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: PATIENT DETAILS ================= */}
        {currentStep === 'patient' && (
          <div className="mt-4 space-y-3.5">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block">
              Patient Registration & Intake Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra Sharma"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
                />
                {formErrors.name && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.name}</p>}
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  Phone Number (10 digits) *
                </label>
                <input
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="e.g. 9830123456"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
                />
                {formErrors.phone && (
                  <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="e.g. ramesh.sharma@example.com"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
                />
                {formErrors.email && (
                  <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">Patient Age *</label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  min={1}
                  max={120}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
                />
                {formErrors.age && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.age}</p>}
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                Chief Concern & Symptoms for Doctor (from Triage Intake)
              </label>
              <textarea
                rows={2}
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                placeholder="Describe your symptoms, duration, or key concerns..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* Step 2 Footer Actions */}
            <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3.5">
              <button
                type="button"
                onClick={() => setCurrentStep('slots')}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change Time Slot</span>
              </button>

              <button
                type="button"
                onClick={handleProceedToReview}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition cursor-pointer active:scale-98"
              >
                <span>Continue to Review & Pricing</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: BOOKING REVIEW & RISK-BASED PRICING ================= */}
        {currentStep === 'review' && (
          <div className="mt-4 space-y-4">
            {/* Booking Summary Card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs space-y-3 shadow-2xs">
              <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] block border-b border-zinc-100 pb-1.5">
                Consultation Summary Review
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                    Consulting Doctor
                  </span>
                  <p className="font-bold text-zinc-900 mt-0.5">{doctor.name}</p>
                  <p className="text-teal-700 font-semibold">{doctor.specialty}</p>
                  <p className="text-zinc-500 text-[11px]">{clinic.name} &bull; {clinic.area}</p>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                    Scheduled Date & Time Slot
                  </span>
                  <p className="font-bold text-zinc-900 mt-0.5">
                    {selectedDate} &bull; {selectedSlot?.time}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded mt-1">
                    <CheckCircle2 className="h-3 w-3" /> Slot Locked
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                    Registered Patient
                  </span>
                  <p className="font-bold text-zinc-900 mt-0.5">{patientName} (Age: {patientAge})</p>
                  <p className="text-zinc-500">{patientPhone} &bull; {patientEmail}</p>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                    Reported Concern
                  </span>
                  <p className="text-zinc-700 font-medium line-clamp-2 mt-0.5">
                    {concern || 'Standard consultation assessment'}
                  </p>
                </div>
              </div>
            </div>

            {/* Risk-based Transparent Pricing Card */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 p-4 text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
                    Risk-based Transparent Pricing
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      triageCategory === 'URGENT'
                        ? 'bg-rose-100 text-rose-800'
                        : triageCategory === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : triageCategory === 'MODERATE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Triage: {triageCategory}
                  </span>
                </div>
                <span className="text-[10px] text-teal-800 font-semibold bg-teal-100 rounded px-1.5 py-0.2">
                  Pay at Clinic Desk
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 pt-1">
                <span>Doctor Base Consultation Fee:</span>
                <span className="font-medium text-zinc-900">INR {pricing.baseFee}.00</span>
              </div>

              <div className="flex justify-between text-zinc-600">
                <span>{pricing.triageAdjustmentLabel}:</span>
                <span className="font-medium text-zinc-900">INR {pricing.triageAdjustment}.00</span>
              </div>

              <div className="flex justify-between text-zinc-600">
                <span>Hospital Facility & Desk Registration Fee:</span>
                <span className="font-medium text-zinc-900">INR {pricing.hospitalServiceFee}.00</span>
              </div>

              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900">
                <span>Total Verified Payable:</span>
                <span className="text-teal-700 text-base">INR {pricing.total}.00</span>
              </div>

              <p className="text-[10px] text-zinc-400 italic pt-1 flex items-center gap-1">
                <Shield className="h-3 w-3 text-teal-600 shrink-0" />
                <span>
                  Transparent clinic pricing directly synchronized with hospital desk. Zero surge fees applied.
                </span>
              </p>
            </div>

            {/* Step 3 Footer Actions */}
            <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3.5">
              <button
                type="button"
                onClick={() => setCurrentStep('patient')}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Patient Details</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || !selectedSlot || secondsRemaining <= 0}
                onClick={handleConfirmBooking}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-98 cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Confirming with Clinic...' : 'Confirm Booking'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
