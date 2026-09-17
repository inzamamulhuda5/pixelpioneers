import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  Filter,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import { Clinic, MetroCity, SpecialtyType } from '../../types';
import { CLINICS_DATABASE, METRO_CITIES } from '../../data/clinicsAndDoctors';

interface ClinicDiscoveryViewProps {
  selectedCity: MetroCity;
  setSelectedCity: (city: MetroCity) => void;
  preferredSpecialty?: string;
  onSelectClinic: (clinic: Clinic) => void;
  onSelectDoctorForClinic: (clinic: Clinic) => void;
}

const ALL_SPECIALTIES: SpecialtyType[] = [
  'Cardiology',
  'Neurology',
  'General Medicine',
  'Pulmonology',
  'Orthopedics',
  'Pediatrics',
  'Dermatology',
];

export const ClinicDiscoveryView: React.FC<ClinicDiscoveryViewProps> = ({
  selectedCity,
  setSelectedCity,
  preferredSpecialty,
  onSelectClinic,
  onSelectDoctorForClinic,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(preferredSpecialty || 'All');

  // Filter clinics
  const filteredClinics = CLINICS_DATABASE.filter((clinic) => {
    // City match
    if (clinic.city !== selectedCity) return false;

    // Specialty filter
    if (selectedSpecialty !== 'All') {
      const primary = clinic.primarySpecialty || clinic.specialties[0] || '';
      const matchPrimary = primary.toLowerCase() === selectedSpecialty.toLowerCase();
      const matchOther = clinic.specialties.some(
        (s) => s.toLowerCase() === selectedSpecialty.toLowerCase()
      );
      if (!matchPrimary && !matchOther) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = clinic.name.toLowerCase().includes(q);
      const matchArea = clinic.area.toLowerCase().includes(q);
      const matchSpec = clinic.specialties.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchArea && !matchSpec) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <Building2 className="h-4 w-4" />
            <span>Healthcare Facility Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-['Space_Grotesk'] mt-1">
            Discover Verified Clinics in {selectedCity}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Real-time appointment capacity &bull; Transparent clinic fees &bull; Emergency equipped centers
          </p>
        </div>

        {/* City Switcher */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-2xs">
          <MapPin className="h-4 w-4 text-teal-600" />
          <span className="text-xs font-bold text-zinc-700">City:</span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value as MetroCity)}
            className="bg-transparent text-xs font-bold text-zinc-900 focus:outline-hidden cursor-pointer"
          >
            {METRO_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by clinic name, locality (e.g. Salt Lake, Koramangala)..."
            className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-hidden shadow-2xs"
          />
        </div>

        {/* Specialty Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedSpecialty('All')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
              selectedSpecialty === 'All'
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All
          </button>
          {ALL_SPECIALTIES.map((spec) => {
            const isMatch = selectedSpecialty.toLowerCase() === spec.toLowerCase();
            return (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                  isMatch
                    ? 'bg-teal-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {spec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clinics Grid */}
      {filteredClinics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClinics.map((clinic) => (
            <div
              key={clinic.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-md"
            >
              <div>
                {/* Top Badges */}
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 ring-1 ring-teal-600/20">
                    <Stethoscope className="h-3 w-3 text-teal-600" />
                    {clinic.primarySpecialty || clinic.specialties[0]}
                  </span>

                  {(clinic.emergencyCapable || clinic.emergencyCareAvailable) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-500/20">
                      <AlertOctagon className="h-3 w-3 text-rose-600" />
                      24/7 Emergency
                    </span>
                  )}
                </div>

                {/* Clinic Name & Area */}
                <h3 className="text-lg font-bold text-zinc-900 font-['Space_Grotesk'] leading-snug">
                  {clinic.name}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                  <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>
                    {clinic.area}, {clinic.city}
                  </span>
                </div>

                <p className="mt-2 text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                  {clinic.description ||
                    `${clinic.name} provides comprehensive outpatient consultation and clinical diagnostics in ${clinic.area}.`}
                </p>

                {/* Key Metrics */}
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-2.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Consultation Fee
                    </span>
                    <span className="font-bold text-zinc-900">
                      INR {clinic.consultationFeeRange.min} - {clinic.consultationFeeRange.max}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Next Available
                    </span>
                    <span className="font-bold text-teal-700 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {clinic.nextAvailableSlot}
                    </span>
                  </div>
                </div>

                {/* Doctor Count & Operating Hours */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-zinc-400" />
                    {clinic.doctorCount} Doctors on panel
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    {clinic.operatingHours || '08:00 AM - 08:00 PM'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center gap-2">
                <button
                  onClick={() => onSelectDoctorForClinic(clinic)}
                  className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition text-center cursor-pointer"
                >
                  View Doctors ({clinic.doctorCount})
                </button>
                <button
                  onClick={() => onSelectClinic(clinic)}
                  className="flex items-center justify-center rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition cursor-pointer"
                  title="Book directly at this clinic"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <Building2 className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-800">No clinics match this filter</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Try switching the specialty category or selecting a different metro city from the dropdown above.
          </p>
          <button
            onClick={() => {
              setSelectedSpecialty('All');
              setSearchQuery('');
            }}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
