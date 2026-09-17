import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  FileUp,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  Stethoscope,
  HeartPulse,
  Brain,
} from 'lucide-react';
import { DEMO_SCENARIOS } from '../../data/demoScenarios';
import { DemoScenario } from '../../types';

interface HeroChatComposerProps {
  onStartChat: (initialMessage: string) => void;
  onOpenVoice: () => void;
  onOpenUpload: () => void;
  onSelectDemo: (scenario: DemoScenario) => void;
  onNavigateTab: (tab: 'clinics' | 'doctors' | 'bookings') => void;
}

export const HeroChatComposer: React.FC<HeroChatComposerProps> = ({
  onStartChat,
  onOpenVoice,
  onOpenUpload,
  onSelectDemo,
  onNavigateTab,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onStartChat(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      {/* Top Pill */}
      <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3.5 py-1.5 border border-teal-200/70 mb-6 shadow-2xs">
        <Sparkles className="h-3.5 w-3.5 text-teal-600" />
        <span className="text-xs font-semibold text-teal-800">
          AI Patient Intake &bull; Transparent Triage &bull; Direct Clinic Booking
        </span>
      </div>

      {/* Large Welcoming Heading */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-zinc-900 text-center tracking-tight font-['Space_Grotesk'] max-w-2xl leading-tight">
        How can Pixel Pioneers help you today?
      </h1>

      {/* Subheading */}
      <p className="mt-3 text-base sm:text-lg text-zinc-600 text-center max-w-xl leading-relaxed">
        Describe what you&apos;re experiencing, upload a report, or talk to our AI assistant.
      </p>

      {/* Primary AI Composer Box */}
      <div className="mt-8 w-full max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-2xl border border-zinc-300 bg-white p-3 sm:p-4 shadow-lg shadow-zinc-200/50 transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20"
        >
          <textarea
            id="composer-input"
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what you're experiencing (e.g. 'I've had a bad headache for three days' or 'Chest tightness when climbing stairs')..."
            className="w-full resize-none border-0 bg-transparent text-sm sm:text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden leading-relaxed"
          />

          {/* Action Row */}
          <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenUpload}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition cursor-pointer"
                title="Attach PDF prescription or medical image"
              >
                <Paperclip className="h-4 w-4 text-teal-600" />
                <span className="hidden sm:inline">Upload report</span>
              </button>

              <button
                type="button"
                onClick={onOpenVoice}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition cursor-pointer"
                title="Live hands-free voice intake"
              >
                <Mic className="h-4 w-4 text-teal-600" />
                <span className="hidden sm:inline">Voice chat</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs transition hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
              title="Send to AI Intake Assistant"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition cursor-pointer"
        >
          <FileUp className="h-3.5 w-3.5 text-teal-600" />
          <span>Upload Prescription</span>
        </button>

        <button
          onClick={onOpenVoice}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition cursor-pointer"
        >
          <Mic className="h-3.5 w-3.5 text-teal-600" />
          <span>Start Voice Chat</span>
        </button>

        <button
          onClick={() => onNavigateTab('doctors')}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition cursor-pointer"
        >
          <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
          <span>Find a Doctor</span>
        </button>

        <button
          onClick={() => onNavigateTab('bookings')}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition cursor-pointer"
        >
          <CalendarCheck className="h-3.5 w-3.5 text-teal-600" />
          <span>View My Bookings</span>
        </button>
      </div>

      {/* Prominent Demo Cases Section */}
      <div className="mt-12 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Interactive Test Scenarios
            </span>
            <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-800">
              Instant Evaluation
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">1-click full intake & triage</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_SCENARIOS.map((scenario, index) => {
            const isCardio = scenario.id.includes('cardio');
            const Icon = isCardio ? HeartPulse : Brain;
            const accentColor = isCardio ? 'text-rose-600 bg-rose-50' : 'text-indigo-600 bg-indigo-50';

            return (
              <div
                key={scenario.id}
                onClick={() => onSelectDemo(scenario)}
                className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-teal-400 hover:shadow-md cursor-pointer text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                      {scenario.badge}
                    </span>
                  </div>

                  <h3 className="font-bold text-zinc-900 text-sm font-['Space_Grotesk'] group-hover:text-teal-700 transition">
                    {scenario.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    {scenario.shortDescription}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-100 text-xs font-semibold text-teal-600">
                  <span>Load Demo Case {index + 1}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
