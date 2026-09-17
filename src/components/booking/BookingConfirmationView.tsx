import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  QrCode,
  Share2,
  Stethoscope,
  User,
  ArrowRight,
} from 'lucide-react';
import { Appointment } from '../../types';
import { downloadAppointmentReceipt, downloadCalendarInvite } from '../../services/pdfService';

interface BookingConfirmationViewProps {
  appointment: Appointment;
  onViewMyBookings: () => void;
  onBackToHome: () => void;
}

export const BookingConfirmationView: React.FC<BookingConfirmationViewProps> = ({
  appointment,
  onViewMyBookings,
  onBackToHome,
}) => {
  // Fire celebratory confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0d9488', '#14b8a6', '#0f766e', '#38bdf8'],
      });
    } catch (e) {
      // Ignore if confetti fails in iframe
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Confirmation Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xl text-center">
        {/* Animated Check Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-8 ring-teal-50/50 mb-4">
          <CheckCircle2 className="h-10 w-10 text-teal-600" />
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 uppercase tracking-wider">
          Appointment Confirmed
        </span>

        <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-zinc-900 font-['Space_Grotesk']">
          Your Consultation is Reserved!
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500">
          Booking Reference ID: <strong className="text-zinc-900 font-mono">{appointment.id}</strong>
        </p>

        {/* Appointment Details Box */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 text-left text-xs space-y-4">
          {/* Doctor & Clinic */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
            <div className="flex items-center gap-3">
              <img
                src={appointment.doctor.avatarUrl || `/doctors/${appointment.doctor.id}.jpg`}
                alt={appointment.doctor.name}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-xl object-cover border border-zinc-200 shrink-0 aspect-square"
              />
              <div>
                <span className="font-bold text-zinc-900 text-sm">{appointment.doctor.name}</span>
                <p className="text-teal-700 font-semibold">{appointment.specialty}</p>
                <p className="text-zinc-500 text-[11px]">{appointment.doctor.qualification}</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="font-bold text-zinc-900 text-xs block">{appointment.clinic.name}</span>
              <p className="text-zinc-500 text-[11px]">{appointment.clinic.address}</p>
              <p className="text-zinc-500 text-[11px]">
                {appointment.clinic.area}, {appointment.clinic.city}
              </p>
            </div>
          </div>

          {/* Date, Time & Patient */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl bg-white p-3 border border-zinc-200">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                Consultation Date
              </span>
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <Calendar className="h-4 w-4 text-teal-600" />
                <span>{appointment.date}</span>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 border border-zinc-200">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                Scheduled Slot
              </span>
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <Clock className="h-4 w-4 text-teal-600" />
                <span>{appointment.time}</span>
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 border border-zinc-200">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                Registered Patient
              </span>
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 truncate">
                <User className="h-4 w-4 text-teal-600" />
                <span className="truncate">{appointment.patientName}</span>
              </div>
            </div>
          </div>

          {/* Pricing Total */}
          <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-xs">
            <span className="font-semibold text-zinc-700">Total Consultation & Admin Fee:</span>
            <span className="text-sm font-bold text-teal-700">INR {appointment.pricing.total}.00</span>
          </div>
        </div>

        {/* Action Buttons: PDF Receipt & Calendar */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => downloadAppointmentReceipt(appointment)}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-700 transition active:scale-98 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Download Receipt (PDF)</span>
          </button>

          <button
            onClick={() => downloadCalendarInvite(appointment)}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-800 shadow-2xs hover:bg-zinc-50 transition cursor-pointer"
          >
            <CalendarCheck className="h-4 w-4 text-teal-600" />
            <span>Add to Calendar (.ics)</span>
          </button>

          <button
            onClick={onViewMyBookings}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-zinc-800 transition cursor-pointer"
          >
            <span>Go to My Bookings</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Prototype notice */}
        <p className="mt-6 text-[11px] text-zinc-400 italic">
          Please arrive 15 minutes prior to your scheduled slot with your government photo ID and reference ID.
        </p>
      </div>
    </div>
  );
};
