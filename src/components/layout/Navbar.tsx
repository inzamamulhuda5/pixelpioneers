import React from 'react';
import {
  Activity,
  CalendarCheck,
  FileText,
  MapPin,
  Menu,
  MessageSquare,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { MetroCity } from '../../types';
import { METRO_CITIES } from '../../data/clinicsAndDoctors';

interface NavbarProps {
  activeTab: 'home' | 'chat' | 'assessment' | 'clinics' | 'doctors' | 'bookings' | 'history';
  setActiveTab: (tab: 'home' | 'chat' | 'assessment' | 'clinics' | 'doctors' | 'bookings' | 'history') => void;
  selectedCity: MetroCity;
  setSelectedCity: (city: MetroCity) => void;
  hasActiveAssessment: boolean;
  upcomingBookingsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedCity,
  setSelectedCity,
  hasActiveAssessment,
  upcomingBookingsCount,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'home', label: 'Home', icon: Sparkles },
    { id: 'chat', label: 'AI Intake', icon: MessageSquare },
    ...(hasActiveAssessment ? [{ id: 'assessment', label: 'Assessment', icon: Activity }] : []),
    { id: 'clinics', label: 'Clinics', icon: MapPin },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'bookings', label: 'My Bookings', icon: CalendarCheck, badge: upcomingBookingsCount },
    { id: 'history', label: 'Assessments', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Zone 1: Brand Logo & Tagline */}
        <div className="flex items-center shrink-0 min-w-[200px]">
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-90 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 shadow-xs shrink-0">
              <div className="grid grid-cols-2 gap-1">
                <div className="h-2 w-2 rounded-xs bg-teal-400" />
                <div className="h-2 w-2 rounded-xs bg-teal-200" />
                <div className="h-2 w-2 rounded-xs bg-teal-600" />
                <div className="h-2 w-2 rounded-xs bg-emerald-400" />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-bold tracking-tight text-zinc-900 text-base sm:text-lg font-['Space_Grotesk'] leading-tight">
                PIXEL<br />PIONEERS
              </span>
              <p className="text-[11px] text-zinc-500 whitespace-nowrap tracking-tight mt-0.5 leading-none">
                Intake &bull; Triage &bull; Clinic Coordination
              </p>
            </div>
          </button>
        </div>

        {/* Zone 2: Center Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1.5 xl:gap-2.5 justify-center flex-1">
          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-600/20 whitespace-nowrap shrink-0">
            AI Health
          </span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all whitespace-nowrap shrink-0 h-9 ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-600' : 'text-zinc-400'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: City Selector & Start Intake Actions */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-1.5 text-xs text-zinc-700 whitespace-nowrap shrink-0 h-9">
            <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
            <span className="font-medium text-zinc-500 whitespace-nowrap">City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value as MetroCity)}
              className="bg-transparent font-semibold text-zinc-900 focus:outline-hidden cursor-pointer whitespace-nowrap pr-1"
            >
              {METRO_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setActiveTab('chat')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700 active:scale-98 cursor-pointer whitespace-nowrap shrink-0 h-9"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-200 shrink-0" />
            <span className="whitespace-nowrap">Start Intake</span>
          </button>
        </div>

        {/* Mobile / Tablet Controls (under lg breakpoint) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-800">
            <MapPin className="h-3 w-3 text-teal-600 shrink-0" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value as MetroCity)}
              className="bg-transparent font-medium text-zinc-800 focus:outline-hidden cursor-pointer text-xs"
            >
              {METRO_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setActiveTab('chat')}
            className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700"
          >
            <Sparkles className="h-3 w-3 text-teal-200" />
            <span className="whitespace-nowrap">Intake</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-600/20">
              AI Health
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              City: <strong className="text-zinc-800">{selectedCity}</strong>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-teal-600" />
                    <span>{item.label}</span>
                  </div>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
