import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  RefreshCw,
  Stethoscope,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Appointment, TimeSlot } from '../../types';
import {
  cancelAppointment,
  getAllAppointments,
  getAvailableDates,
  getTimeSlotsForDate,
  rescheduleAppointment,
} from '../../services/bookingStore';
import { downloadAppointmentReceipt, downloadCalendarInvite } from '../../services/pdfService';

interface MyBookingsViewProps {
  onStartNewBooking: () => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({ onStartNewBooking }) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>(getAllAppointments());

  // Reschedule state
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newSlot, setNewSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Cancellation state
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Personal schedule conflict');

  const refreshList = () => {
    setAppointments(getAllAppointments());
  };

  // Filter appointments by tab
  const filteredAppointments = appointments.filter((appt) => {
    if (activeTab === 'upcoming') return appt.status === 'confirmed';
    if (activeTab === 'completed') return appt.status === 'completed';
    if (activeTab === 'cancelled') return appt.status === 'cancelled';
    return true;
  });

  // Open Reschedule Modal
  const handleOpenReschedule = (appt: Appointment) => {
    const dates = getAvailableDates();
    setReschedulingAppt(appt);
    setNewDate(dates[1] || dates[0]);
    const slots = getTimeSlotsForDate(appt.doctor.id, appt.clinic.id, dates[1] || dates[0]);
    setAvailableSlots(slots);
    const firstFree = slots.find((s) => s.status.toUpperCase() === 'AVAILABLE');
    setNewSlot(firstFree || null);
    setRescheduleError(null);
  };

  const handleDateChangeInReschedule = (d: string) => {
    if (!reschedulingAppt) return;
    setNewDate(d);
    const slots = getTimeSlotsForDate(reschedulingAppt.doctor.id, reschedulingAppt.clinic.id, d);
    setAvailableSlots(slots);
    const firstFree = slots.find((s) => s.status.toUpperCase() === 'AVAILABLE');
    setNewSlot(firstFree || null);
  };

  const handleConfirmReschedule = () => {
    if (!reschedulingAppt || !newSlot) return;

    try {
      rescheduleAppointment(reschedulingAppt.id, newDate, newSlot.time, newSlot.id);
      refreshList();
      setReschedulingAppt(null);
    } catch (err: any) {
      setRescheduleError(err.message || 'Unable to reschedule to this slot.');
    }
  };

  // Open Cancel Modal
  const handleOpenCancel = (appt: Appointment) => {
    setCancellingAppt(appt);
    setCancelReason('Personal schedule conflict');
  };

  const handleConfirmCancel = () => {
    if (!cancellingAppt) return;
    cancelAppointment(cancellingAppt.id, cancelReason);
    refreshList();
    setCancellingAppt(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <CalendarCheck className="h-4 w-4" />
            <span>Consultation Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-['Space_Grotesk'] mt-1">
            My Appointments
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Manage your clinic consultations, download verified receipts, or reschedule time slots
          </p>
        </div>

        <button
          onClick={onStartNewBooking}
          className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition cursor-pointer"
        >
          + Book New Consultation
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'upcoming'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Upcoming ({appointments.filter((a) => a.status === 'confirmed').length})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Completed ({appointments.filter((a) => a.status === 'completed').length})
        </button>

        <button
          onClick={() => setActiveTab('cancelled')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'cancelled'
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Cancelled ({appointments.filter((a) => a.status === 'cancelled').length})
        </button>
      </div>

      {/* Bookings List */}
      {filteredAppointments.length > 0 ? (
        <div className="space-y-4">
          {filteredAppointments.map((appt) => {
            const isConfirmed = appt.status === 'confirmed';
            const isCancelled = appt.status === 'cancelled';
            const isCompleted = appt.status === 'completed';

            return (
              <div
                key={appt.id}
                className={`rounded-2xl border bg-white p-5 shadow-2xs transition ${
                  isCancelled ? 'border-zinc-200 opacity-80' : 'border-zinc-200 hover:border-teal-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Doctor & Clinic */}
                  <div className="flex items-start gap-3.5">
                    <img
                      src={appt.doctor.avatarUrl || `/doctors/${appt.doctor.id}.jpg`}
                      alt={appt.doctor.name}
                      referrerPolicy="no-referrer"
                      className="h-14 w-14 rounded-2xl object-cover border border-zinc-200 shrink-0 aspect-square"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 text-base">{appt.doctor.name}</span>
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                          {appt.specialty}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-600 mt-0.5 font-medium">{appt.clinic.name}</p>
                      <p className="text-[11px] text-zinc-400">
                        {appt.clinic.address} &bull; {appt.clinic.area}, {appt.clinic.city}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-700">
                        <span className="flex items-center gap-1 font-semibold text-zinc-900">
                          <Calendar className="h-3.5 w-3.5 text-teal-600" />
                          {appt.date}
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-zinc-900">
                          <Clock className="h-3.5 w-3.5 text-teal-600" />
                          {appt.time}
                        </span>
                        <span className="flex items-center gap-1 text-zinc-500">
                          <User className="h-3.5 w-3.5 text-zinc-400" />
                          Patient: {appt.patientName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Fee */}
                  <div className="text-left sm:text-right flex sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-2">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                          isConfirmed
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                            : isCompleted
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                            : 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-300'
                        }`}
                      >
                        {isConfirmed && <CheckCircle2 className="h-3 w-3" />}
                        {isCancelled && <XCircle className="h-3 w-3" />}
                        {appt.status}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Total Fee</span>
                      <span className="text-sm font-bold text-zinc-900">INR {appt.pricing.total}</span>
                    </div>
                  </div>
                </div>

                {/* Reschedule History notice if modified */}
                {appt.updatedAt && (
                  <div className="mt-3 text-[11px] text-zinc-400 italic">
                    Appointment was rescheduled on {new Date(appt.updatedAt).toLocaleDateString()}
                  </div>
                )}

                {/* Cancelled note */}
                {isCancelled && appt.cancellationReason && (
                  <div className="mt-3 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 border border-zinc-200">
                    <span className="font-semibold text-zinc-800">Cancellation Reason: </span>
                    {appt.cancellationReason}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-zinc-400">Ref: {appt.id}</span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => downloadAppointmentReceipt(appt)}
                      className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-teal-600" />
                      <span>PDF Receipt</span>
                    </button>

                    {isConfirmed && (
                      <>
                        <button
                          onClick={() => downloadCalendarInvite(appt)}
                          className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
                        >
                          <CalendarCheck className="h-3.5 w-3.5 text-teal-600" />
                          <span>.ics Calendar</span>
                        </button>

                        <button
                          onClick={() => handleOpenReschedule(appt)}
                          className="flex items-center gap-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 transition cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          onClick={() => handleOpenCancel(appt)}
                          className="flex items-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <CalendarCheck className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-800">No {activeTab} appointments found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'upcoming'
              ? 'You do not have any upcoming consultations reserved yet.'
              : `You do not have any appointments under ${activeTab}.`}
          </p>
          <button
            onClick={onStartNewBooking}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
          >
            Find a Clinic & Book
          </button>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900 font-['Space_Grotesk']">
                Reschedule Appointment
              </h3>
              <button
                onClick={() => setReschedulingAppt(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 text-xs text-zinc-600">
              Select a new date and time slot for <strong>{reschedulingAppt.doctor.name}</strong>. Your
              previous slot will be released back to the clinic pool.
            </div>

            {rescheduleError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{rescheduleError}</span>
              </div>
            )}

            {/* Date Picker */}
            <div className="mt-4">
              <label className="text-xs font-bold text-zinc-700 block mb-1.5">Select New Date</label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {getAvailableDates().map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDateChangeInReschedule(d)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition shrink-0 ${
                      newDate === d
                        ? 'bg-teal-600 text-white font-bold'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Slots Picker with Real States */}
            <div className="mt-4">
              <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                Select New Time Slot
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {availableSlots.map((s) => {
                  const statusUpper = s.status.toUpperCase();
                  const isAvailable = statusUpper === 'AVAILABLE';
                  const isSelected = newSlot?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setNewSlot(s)}
                      className={`flex flex-col rounded-lg py-1.5 px-2 text-xs font-semibold transition text-left ${
                        isSelected
                          ? 'bg-teal-600 text-white font-bold shadow-2xs'
                          : isAvailable
                          ? 'bg-zinc-50 border border-zinc-200 text-zinc-800 hover:border-teal-400 hover:bg-teal-50/50'
                          : 'bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-55'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={!isAvailable && statusUpper !== 'HELD' ? 'line-through' : ''}>
                          {s.time}
                        </span>
                        <span
                          className={`text-[9px] font-bold rounded px-1 py-0.2 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : isAvailable
                              ? 'bg-emerald-100 text-emerald-800'
                              : statusUpper === 'HELD'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-zinc-200 text-zinc-600'
                          }`}
                        >
                          {statusUpper === 'AVAILABLE'
                            ? 'Free'
                            : statusUpper === 'HELD'
                            ? 'Held'
                            : statusUpper === 'UNAVAILABLE'
                            ? 'Unavail'
                            : 'Booked'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                onClick={() => setReschedulingAppt(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                disabled={!newSlot}
                onClick={handleConfirmReschedule}
                className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-40"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900 font-['Space_Grotesk'] text-rose-600">
                Cancel Consultation
              </h3>
              <button
                onClick={() => setCancellingAppt(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-zinc-600 leading-relaxed">
              Are you sure you wish to cancel this appointment with{' '}
              <strong>{cancellingAppt.doctor.name}</strong> on {cancellingAppt.date} at{' '}
              {cancellingAppt.time}?
            </p>

            <div className="mt-4">
              <label className="text-xs font-bold text-zinc-700 block mb-1">
                Reason for Cancellation
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-800"
              >
                <option value="Personal schedule conflict">Personal schedule conflict</option>
                <option value="Condition improved / Symptoms resolved">
                  Condition improved / Symptoms resolved
                </option>
                <option value="Seeking emergency hospital care">Seeking emergency hospital care</option>
                <option value="Booking at different clinic">Booking at different clinic</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
              <button
                onClick={() => setCancellingAppt(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Keep Booking
              </button>
              <button
                onClick={handleConfirmCancel}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
