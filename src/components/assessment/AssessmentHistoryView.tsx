import React from 'react';
import { Activity, ArrowRight, Calendar, Check, Clock, FileText, Sparkles, Stethoscope } from 'lucide-react';
import { AssessmentResult } from '../../types';

interface AssessmentHistoryViewProps {
  assessments: AssessmentResult[];
  onSelectAssessment: (assessment: AssessmentResult) => void;
  onStartNewIntake: () => void;
}

export const AssessmentHistoryView: React.FC<AssessmentHistoryViewProps> = ({
  assessments,
  onSelectAssessment,
  onStartNewIntake,
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <FileText className="h-4 w-4" />
            <span>Health History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-['Space_Grotesk'] mt-1">
            Intake Assessments
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Audit logs of your AI-assisted clinical interviews, triage indicators, and matched specialties
          </p>
        </div>

        <button
          onClick={onStartNewIntake}
          className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition cursor-pointer"
        >
          + New Clinical Intake
        </button>
      </div>

      {assessments.length > 0 ? (
        <div className="space-y-4">
          {assessments.map((a) => (
            <div
              key={a.id}
              onClick={() => onSelectAssessment(a)}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-teal-400 hover:shadow-md cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      a.triage.category === 'URGENT'
                        ? 'bg-rose-100 text-rose-800'
                        : a.triage.category === 'HIGH'
                        ? 'bg-amber-100 text-amber-800'
                        : a.triage.category === 'MODERATE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {a.triage.category} Priority
                  </span>
                  <span className="text-xs font-bold text-teal-700 flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" />
                    {a.recommendedSpecialty}
                  </span>
                </div>

                <h3 className="font-bold text-zinc-900 text-base font-['Space_Grotesk']">
                  {a.patientSummary.chiefConcern}
                </h3>
                <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                  {a.aiSummaryText}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                  <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  <span>&bull;</span>
                  <span>ID: {a.id}</span>
                  {a.documentFindings.length > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>{a.documentFindings.length} Document(s) Attached</span>
                    </>
                  )}
                </div>
              </div>

              <button className="flex items-center gap-1 text-xs font-bold text-teal-600 self-start sm:self-center">
                <span>View Full Details</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
          <Activity className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-800">No previous assessments</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Complete an AI clinical intake conversation or upload a prescription to generate your first assessment.
          </p>
          <button
            onClick={onStartNewIntake}
            className="mt-4 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
          >
            Start Clinical Intake
          </button>
        </div>
      )}
    </div>
  );
};
