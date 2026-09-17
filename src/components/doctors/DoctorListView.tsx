import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Globe,
  GraduationCap,
  MapPin,
  Search,
  Star,
  Stethoscope,
  X,
} from 'lucide-react';
import { Clinic, Doctor, MetroCity, SpecialtyType } from '../../types';
import { DOCTORS_DATABASE } from '../../data/clinicsAndDoctors';

interface DoctorListViewProps {
  selectedCity: MetroCity;
  selectedClinicFilter?: Clinic | null;
  onClearClinicFilter: () => void;
  preferredSpecialty?: string;
  onBookDoctor: (doctor: Doctor) => void;
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

export const DoctorListView: React.FC<DoctorListViewProps> = ({
  selectedCity,
  selectedClinicFilter,
  onClearClinicFilter,
  preferredSpecialty,
  onBookDoctor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(preferredSpecialty || 'All');
  const [viewingProfile, setViewingProfile] = useState<Doctor | null>(null);

  // Filter doctors
  const filteredDoctors = DOCTORS_DATABASE.filter((doctor) => {
    // If clinic filter is active
    if (selectedClinicFilter && doctor.clinicId !== selectedClinicFilter.id) {
      return false;
    }

    // City match
    if (doctor.city !== selectedCity) return false;

    // Specialty match
    if (selectedSpecialty !== 'All') {
      if (doctor.specialty.toLowerCase() !== selectedSpecialty.toLowerCase()) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = doctor.name.toLowerCase().includes(q);
      const matchSpec = doctor.specialty.toLowerCase().includes(q);
      const matchClinic = doctor.clinicName.toLowerCase().includes(q);
      if (!matchName && !matchSpec && !matchClinic) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <Stethoscope className="h-4 w-4" />
            <span>Consulting Physicians</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-['Space_Grotesk'] mt-1">
            Verified Doctors in {selectedCity}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Board certified specialists &bull; Transparent consultation charges &bull; Instant slot booking
          </p>
        </div>

        {/* If clinic filter active, show indicator pill */}
        {selectedClinicFilter && (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs text-teal-900">
            <span>Filtered by: <strong>{selectedClinicFilter.name}</strong></span>
            <button
              onClick={onClearClinicFilter}
              className="rounded-full p-0.5 hover:bg-teal-200/60 transition"
              title="Clear clinic filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor name or specialty..."
            className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-hidden shadow-2xs"
          />
        </div>

        {/* Specialty Filter Pills */}
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
                  isMatch ? 'bg-teal-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {spec}
              </button>
            );
          })}
        </div>
      </div>

      {/* Doctor Cards Grid */}
      {filteredDoctors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDoctors.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-md"
            >
              <div>
                {/* Doctor Head Info */}
                <div className="flex items-start gap-3.5">
                  <div className="relative">
                    <img
                      src={doc.avatarUrl || `/doctors/${doc.id}.jpg`}
                      alt={doc.name}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0 aspect-square"
                    />
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[10px]">
                      ✓
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 ring-1 ring-teal-600/20">
                        {doc.specialty}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{doc.rating}</span>
                        <span className="text-[10px] text-zinc-400 font-normal">
                          ({doc.reviewsCount ?? doc.reviewCount ?? 120})
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-zinc-900 font-['Space_Grotesk'] mt-1 truncate">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-zinc-500 truncate">{doc.qualification}</p>
                  </div>
                </div>

                {/* Experience & Languages */}
                <div className="mt-3.5 space-y-1.5 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span>{doc.experienceYears} Years Clinical Experience</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{doc.clinicName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{doc.languages.join(', ')}</span>
                  </div>
                </div>

                {/* Consultation Fee & Availability */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 p-2.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Fee</span>
                    <span className="font-bold text-zinc-900">INR {doc.consultationFee}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Next Slot</span>
                    <span className="font-bold text-teal-700 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {doc.nextAvailableSlot || doc.nextAvailableTime || 'Today, 04:30 PM'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center gap-2">
                <button
                  onClick={() => setViewingProfile(doc)}
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
                >
                  View Profile
                </button>
                <button
                  onClick={() => onBookDoctor(doc)}
                  className="flex-1 rounded-xl bg-teal-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition active:scale-98 cursor-pointer text-center"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <Stethoscope className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-800">No doctors found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Try adjusting your specialty filter or clear the clinic filter above.
          </p>
          <button
            onClick={() => {
              setSelectedSpecialty('All');
              setSearchQuery('');
              onClearClinicFilter();
            }}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Doctor Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <span className="text-xs font-bold uppercase text-teal-700">Doctor Profile</span>
              <button
                onClick={() => setViewingProfile(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <img
                src={viewingProfile.avatarUrl || `/doctors/${viewingProfile.id}.jpg`}
                alt={viewingProfile.name}
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl object-cover bg-zinc-100 border border-zinc-200 shrink-0 aspect-square"
              />
              <div>
                <h3 className="text-lg font-bold text-zinc-900 font-['Space_Grotesk']">
                  {viewingProfile.name}
                </h3>
                <p className="text-xs text-teal-700 font-semibold">{viewingProfile.specialty}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{viewingProfile.qualification}</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-zinc-600 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-100">
              {viewingProfile.about}
            </p>

            <div className="mt-4 space-y-2 text-xs text-zinc-700">
              <div className="flex justify-between">
                <span className="text-zinc-400">Affiliated Clinic:</span>
                <span className="font-semibold text-zinc-900">{viewingProfile.clinicName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Experience:</span>
                <span className="font-semibold text-zinc-900">{viewingProfile.experienceYears} Years</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Consultation Fee:</span>
                <span className="font-bold text-teal-700">INR {viewingProfile.consultationFee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Languages:</span>
                <span className="font-semibold text-zinc-900">{viewingProfile.languages.join(', ')}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                onClick={() => setViewingProfile(null)}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const doc = viewingProfile;
                  setViewingProfile(null);
                  onBookDoctor(doc);
                }}
                className="flex-1 rounded-xl bg-teal-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition"
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
