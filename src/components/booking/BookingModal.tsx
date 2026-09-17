import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  MapPin,
  Shield,
  Stethoscope,
  User,
  X,
  Sparkles,
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
  reserveSlotTemporary,
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

  // Patient details state
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientAge, setPatientAge] = useState('32');
  const [concern, setConcern] = useState(patientChiefConcern);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Transparent pricing calculation
  const pricing = calculatePricingBreakdown(doctor.consultationFee, triageCategory);

  // Refresh slots when date or doctor changes
  useEffect(() => {
    if (!isOpen) return;
    const currentSlots = getTimeSlotsForDate(doctor.id, clinic.id, selectedDate);
    setSlots(currentSlots);

    // Pick first available if none selected or if selected slot is no longer valid
    const firstAvailable = currentSlots.find((s) => s.status === 'available');
    setSelectedSlot(firstAvailable || null);
  }, [isOpen, selectedDate, doctor.id, clinic.id]);

  if (!isOpen) return null;

  const handleSelectSlot = (slot: TimeSlot) => {
    if (slot.status !== 'available') return;
    reserveSlotTemporary(slot.id);
    setSelectedSlot(slot);
    setBookingError(null);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!patientName.trim()) errs.name = 'Patient name is required';
    if (!patientPhone.trim() || patientPhone.length < 10) {
      errs.phone = 'Valid 10-digit phone number is required';
    }
    if (!patientEmail.trim() || !patientEmail.includes('@')) {
      errs.email = 'Valid email is required';
    }
    if (!patientAge || parseInt(patientAge, 10) < 1) {
      errs.age = 'Age is required';
    }
    if (!selectedSlot) {
      errs.slot = 'Please select an available time slot';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirmBooking = async () => {
    if (!validateForm()) return;
    if (!selectedSlot) return;

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
        chiefConcern: concern.trim() || undefined,
        triageCategory,
      });

      onBookingSuccess(newAppointment);
      onClose();
    } catch (err: any) {
      setBookingError(
        err.message || 'This slot was just taken by another patient. Please select a different time slot.'
      );
      // Refresh slots
      const currentSlots = getTimeSlotsForDate(doctor.id, clinic.id, selectedDate);
      setSlots(currentSlots);
      setSelectedSlot(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group slots by period
  const morningSlots = slots.filter((s) => s.period === 'morning');
  const afternoonSlots = slots.filter((s) => s.period === 'afternoon');
  const eveningSlots = slots.filter((s) => s.period === 'evening');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-zinc-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 font-['Space_Grotesk']">
                Schedule Appointment
              </h2>
              <p className="text-xs text-zinc-500">
                Direct Clinic Desk Synchronization &bull; Instant Confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Doctor & Clinic Summary Bar */}
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <img
              src={doctor.avatarUrl}
              alt={doctor.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-xl object-cover border border-zinc-200"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 text-sm">{doctor.name}</span>
                <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-800">
                  {doctor.specialty}
                </span>
              </div>
              <p className="text-zinc-500 mt-0.5">{clinic.name} &bull; {clinic.area}, {clinic.city}</p>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-zinc-200 sm:pl-4">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Consultation Fee</span>
            <span className="text-sm font-bold text-teal-700">INR {doctor.consultationFee}</span>
          </div>
        </div>

        {/* Conflict Error Alert */}
        {bookingError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{bookingError}</span>
          </div>
        )}

        {/* STEP 1: Date Selector */}
        <div className="mt-5">
          <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block mb-2">
            1. Select Consultation Date
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {dates.map((d, idx) => {
              const isSelected = selectedDate === d;
              const dateObj = new Date(d);
              const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`flex flex-col items-center justify-center rounded-xl border px-3.5 py-2 text-center transition cursor-pointer min-w-[76px] ${
                    isSelected
                      ? 'border-teal-600 bg-teal-600 text-white shadow-xs font-bold'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold ${isSelected ? 'text-teal-100' : 'text-zinc-400'}`}>
                    {dayName}
                  </span>
                  <span className="text-xs font-bold mt-0.5">{monthDay}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Time Slots Grid */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
              2. Select Available Time Slot
            </span>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-teal-500" /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-zinc-300" /> Booked
              </span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {/* Morning */}
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Morning</span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {morningSlots.map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id;
                  const isAvailable = slot.status === 'available';
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => handleSelectSlot(slot)}
                      className={`rounded-lg py-1.5 px-2 text-xs font-semibold transition text-center cursor-pointer ${
                        isSelected
                          ? 'bg-teal-600 text-white shadow-xs font-bold ring-2 ring-teal-600/30'
                          : isAvailable
                          ? 'bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-teal-400 hover:bg-teal-50/50'
                          : 'bg-zinc-100 text-zinc-400 border border-zinc-200 line-through cursor-not-allowed opacity-60'
                      }`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Afternoon & Evening */}
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                Afternoon & Evening
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {[...afternoonSlots, ...eveningSlots].map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id;
                  const isAvailable = slot.status === 'available';
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => handleSelectSlot(slot)}
                      className={`rounded-lg py-1.5 px-2 text-xs font-semibold transition text-center cursor-pointer ${
                        isSelected
                          ? 'bg-teal-600 text-white shadow-xs font-bold ring-2 ring-teal-600/30'
                          : isAvailable
                          ? 'bg-zinc-50 text-zinc-800 border border-zinc-200 hover:border-teal-400 hover:bg-teal-50/50'
                          : 'bg-zinc-100 text-zinc-400 border border-zinc-200 line-through cursor-not-allowed opacity-60'
                      }`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {formErrors.slot && <p className="text-[11px] text-rose-600 mt-1">{formErrors.slot}</p>}
        </div>

        {/* STEP 3: Patient Information */}
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider block mb-2">
            3. Patient Registration Details
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Patient Full Name *</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Ramesh Chandra Sharma"
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
              />
              {formErrors.name && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.name}</p>}
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Phone Number (10 digits) *</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
              />
              {formErrors.phone && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.phone}</p>}
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Email Address *</label>
              <input
                type="email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                placeholder="e.g. patient@gmail.com"
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
              />
              {formErrors.email && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.email}</p>}
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">Patient Age *</label>
              <input
                type="number"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                min={1}
                max={120}
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-teal-500 focus:outline-hidden"
              />
              {formErrors.age && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.age}</p>}
            </div>
          </div>
        </div>

        {/* STEP 4: Transparent Pricing Breakdown */}
        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-3.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">
              Transparent Pricing Breakdown
            </span>
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
            <span>Hospital Administration & Registration Fee:</span>
            <span className="font-medium text-zinc-900">INR {pricing.hospitalServiceFee}.00</span>
          </div>

          <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900">
            <span>Total Payable Amount:</span>
            <span className="text-teal-700">INR {pricing.total}.00</span>
          </div>

          <p className="text-[10px] text-zinc-400 italic pt-1">
            Fees are strictly set by the clinic administration and are not dynamically adjusted by Pixel Pioneers.
          </p>
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting || !selectedSlot}
            onClick={handleConfirmBooking}
            className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-98 cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Confirming with Clinic...' : 'Confirm & Reserve Slot'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
