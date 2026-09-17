import React from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { DEMO_SCENARIOS } from '../../data/demoScenarios';
import { DemoScenario } from '../../types';

interface DemoControlBarProps {
  onLoadScenario: (scenario: DemoScenario) => void;
  onResetDemo: () => void;
  onSimulateConflict: () => void;
  activeScenarioId?: string;
}

export const DemoControlBar: React.FC<DemoControlBarProps> = ({
  onLoadScenario,
  onResetDemo,
  onSimulateConflict,
  activeScenarioId,
}) => {
  const [conflictSimulated, setConflictSimulated] = React.useState(false);

  const handleConflict = () => {
    onSimulateConflict();
    setConflictSimulated(true);
    setTimeout(() => setConflictSimulated(false), 3000);
  };

  return (
    <div className="w-full bg-zinc-900 text-white border-b border-zinc-800 text-xs">
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8 flex flex-wrap lg:flex-nowrap items-center justify-between gap-y-2.5 gap-x-4">
        {/* Badge & Notice */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-500/20 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide text-teal-300 ring-1 ring-teal-500/30 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
            DEMO ENVIRONMENT
          </span>
          <span className="text-zinc-400 text-xs hidden sm:inline whitespace-nowrap">
            Fictional clinical scenarios for rapid evaluation & testing.
          </span>
        </div>

        {/* Quick action controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-zinc-400 text-xs font-medium mr-1 whitespace-nowrap">Load Demo Case:</span>
          {DEMO_SCENARIOS.map((scenario) => {
            const isActive = activeScenarioId === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => onLoadScenario(scenario)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 h-7 text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-teal-500 text-zinc-950 ring-1 ring-teal-300 font-bold'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3 text-teal-400 shrink-0" />
                <span>{scenario.name.split(':')[0]}</span>
              </button>
            );
          })}

          <div className="h-4 w-px bg-zinc-700 mx-1 hidden sm:block shrink-0" />

          {/* Test Slot Double-Booking Contention */}
          <button
            onClick={handleConflict}
            title="Simulates another patient snatching an open slot to test concurrency safety"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 h-7 text-xs text-amber-300 hover:bg-zinc-700 transition cursor-pointer whitespace-nowrap"
          >
            {conflictSimulated ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Slot Locked</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Simulate Slot Contention</span>
              </>
            )}
          </button>

          {/* Reset Demo State */}
          <button
            onClick={onResetDemo}
            title="Reset session, bookings, and intake data to clean state"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1 h-7 text-xs text-zinc-300 hover:bg-red-950/60 hover:text-red-300 transition cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="h-3 w-3 text-zinc-400 shrink-0" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
