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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-3 text-left transition-opacity hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 shadow-sm">
            <div className="grid grid-cols-2 gap-1">
              <div className="h-2 w-2 rounded-xs bg-teal-400" />
              <div className="h-2 w-2 rounded-xs bg-teal-200" />
              <div className="h-2 w-2 rounded-xs bg-teal-600" />
              <div className="h-2 w-2 rounded-xs bg-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-zinc-900 text-lg font-['Space_Grotesk']">
                PIXEL PIONEERS
              </span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-600/20">
                AI Health
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 hidden sm:block">
              Intake &bull; Triage &bull; Clinic Coordination
            </p>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-teal-600' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* City Selector & Controls */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-xs text-zinc-700">
            <MapPin className="h-3.5 w-3.5 text-teal-600" />
            <span className="font-medium text-zinc-500">City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value as MetroCity)}
              className="bg-transparent font-semibold text-zinc-900 focus:outline-hidden cursor-pointer"
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
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-700 active:scale-98 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-200" />
            <span>Start Intake</span>
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value as MetroCity)}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800"
          >
            {METRO_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
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
                    <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">
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
