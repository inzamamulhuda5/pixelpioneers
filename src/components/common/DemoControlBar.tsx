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
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        {/* Badge & Notice */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-teal-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-300 ring-1 ring-teal-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
            DEMO ENVIRONMENT
          </span>
          <span className="text-zinc-400 hidden sm:inline">
            Fictional clinical scenarios for rapid evaluation & testing.
          </span>
        </div>

        {/* Quick action controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-500 text-[11px] font-medium mr-1">Load Demo Case:</span>
          {DEMO_SCENARIOS.map((scenario) => {
            const isActive = activeScenarioId === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => onLoadScenario(scenario)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-teal-500 text-zinc-950 ring-1 ring-teal-300 font-bold'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                <Sparkles className="h-3 w-3 text-teal-400" />
                <span>{scenario.name.split(':')[0]}</span>
              </button>
            );
          })}

          <div className="h-3 w-px bg-zinc-700 mx-1 hidden sm:block" />

          {/* Test Slot Double-Booking Contention */}
          <button
            onClick={handleConflict}
            title="Simulates another patient snatching an open slot to test concurrency safety"
            className="flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-amber-300 hover:bg-zinc-700 transition cursor-pointer"
          >
            {conflictSimulated ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>Slot Locked</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3 w-3 text-amber-400" />
                <span>Simulate Slot Contention</span>
              </>
            )}
          </button>

          {/* Reset Demo State */}
          <button
            onClick={onResetDemo}
            title="Reset session, bookings, and intake data to clean state"
            className="flex items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-red-950/60 hover:text-red-300 transition cursor-pointer"
          >
            <RefreshCw className="h-3 w-3 text-zinc-400" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
