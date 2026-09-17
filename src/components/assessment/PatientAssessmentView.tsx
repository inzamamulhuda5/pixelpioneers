import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  HelpCircle,
  Info,
  Minus,
  Paperclip,
  PhoneCall,
  Shield,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { AssessmentResult, RiskIndicator, TriageCategory } from '../../types';

interface PatientAssessmentViewProps {
  assessment: AssessmentResult;
  onProceedToClinics: (specialty: string) => void;
  onProceedToDoctors: (specialty: string) => void;
  onAttachMoreDocuments: () => void;
}

export const PatientAssessmentView: React.FC<PatientAssessmentViewProps> = ({
  assessment,
  onProceedToClinics,
  onProceedToDoctors,
  onAttachMoreDocuments,
}) => {
  const [showSeeWhyModal, setShowSeeWhyModal] = useState(false);
  const [activeIndicatorFilter, setActiveIndicatorFilter] = useState<'all' | 'matched' | 'unmatched'>('all');

  const { triage, patientSummary, documentFindings, aiSummaryText, recommendedSpecialty, specialtyRationale } =
    assessment;

  // Category Colors
  const getCategoryStyles = (cat: TriageCategory) => {
    switch (cat) {
      case 'URGENT':
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-200',
          text: 'text-rose-800',
          pill: 'bg-rose-600 text-white',
          barColor: 'bg-rose-600',
          stepIndex: 3,
        };
      case 'HIGH':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-800',
          pill: 'bg-amber-600 text-white',
          barColor: 'bg-amber-500',
          stepIndex: 2,
        };
      case 'MODERATE':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          pill: 'bg-blue-600 text-white',
          barColor: 'bg-blue-500',
          stepIndex: 1,
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-800',
          pill: 'bg-emerald-600 text-white',
          barColor: 'bg-emerald-500',
          stepIndex: 0,
        };
    }
  };

  const catStyle = getCategoryStyles(triage.category);

  const filteredIndicators = triage.indicators.filter((ind) => {
    if (activeIndicatorFilter === 'matched') return ind.matched === true;
    if (activeIndicatorFilter === 'unmatched') return ind.matched === false || ind.matched === null;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Prominent Medical Safety Boundary Banner */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 flex items-start gap-3 shadow-2xs">
        <Shield className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-zinc-800">Important Medical Safety Boundary: </span>
          Pixel Pioneers is an AI patient-intake, information organization, and triage coordination system. It is
          <strong> not a licensed medical practitioner</strong> and does not provide a definitive diagnosis or
          prescribe treatments. This indicator is based strictly on information provided during this session.
        </div>
      </div>

      {/* EMERGENCY ADVISORY if Urgent */}
      {triage.isEmergency && (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-5 text-rose-950 shadow-md">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-6 w-6 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-2">
              <h2 className="text-base font-bold text-rose-900 font-['Space_Grotesk']">
                URGENT MEDICAL ATTENTION RECOMMENDED
              </h2>
              <p className="text-xs sm:text-sm text-rose-800 leading-relaxed">
                {triage.emergencyGuidance ||
                  'Based on the reported symptoms (including acute chest pressure or potential anginal features), immediate emergency medical evaluation is strongly recommended.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="tel:102"
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Call Emergency Ambulance (102 / 112)</span>
                </a>
                <span className="text-xs text-rose-700">
                  Appointment booking below is available for non-critical coordination, but do not delay urgent care.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Header / Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <Activity className="h-4 w-4" />
            <span>Clinical Intake Assessment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-['Space_Grotesk'] mt-1">
            Patient Assessment Overview
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Generated on {new Date(assessment.createdAt).toLocaleDateString()} at{' '}
            {new Date(assessment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;
            Reference: {assessment.id}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onAttachMoreDocuments}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition shadow-2xs cursor-pointer"
          >
            <Paperclip className="h-3.5 w-3.5 text-teal-600" />
            <span>Attach Prescription / Report</span>
          </button>

          <button
            onClick={() => onProceedToClinics(recommendedSpecialty)}
            className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition active:scale-98 cursor-pointer"
          >
            <span>Find {recommendedSpecialty} Clinics</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* SECTION 1: Transparent Risk / Triage Component */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Triage Classification
            </span>
            <h2 className="text-xl font-bold text-zinc-900 font-['Space_Grotesk']">
              AI-Assisted Triage Indicator
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className={`rounded-full px-4 py-1.5 text-xs font-extrabold tracking-wide ${catStyle.pill}`}>
              {triage.category} PRIORITY
            </div>
            <button
              onClick={() => setShowSeeWhyModal(true)}
              className="flex items-center gap-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 transition shadow-2xs cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 text-teal-600" />
              <span>See why</span>
            </button>
          </div>
        </div>

        {/* Transparent Triage Scale Visualizer */}
        <div className="mt-6">
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold mb-2">
            <span className={triage.category === 'LOW' ? 'text-emerald-700' : 'text-zinc-400'}>LOW</span>
            <span className={triage.category === 'MODERATE' ? 'text-blue-700' : 'text-zinc-400'}>
              MODERATE
            </span>
            <span className={triage.category === 'HIGH' ? 'text-amber-700' : 'text-zinc-400'}>HIGH</span>
            <span className={triage.category === 'URGENT' ? 'text-rose-700' : 'text-zinc-400'}>URGENT</span>
          </div>

          {/* Progress segments */}
          <div className="grid grid-cols-4 gap-2 h-3.5 rounded-full overflow-hidden bg-zinc-100 p-0.5">
            <div
              className={`rounded-full transition-all ${
                catStyle.stepIndex >= 0 ? 'bg-emerald-500' : 'bg-zinc-200'
              }`}
            />
            <div
              className={`rounded-full transition-all ${
                catStyle.stepIndex >= 1 ? 'bg-blue-500' : 'bg-zinc-200'
              }`}
            />
            <div
              className={`rounded-full transition-all ${
                catStyle.stepIndex >= 2 ? 'bg-amber-500' : 'bg-zinc-200'
              }`}
            />
            <div
              className={`rounded-full transition-all ${
                catStyle.stepIndex >= 3 ? 'bg-rose-500' : 'bg-zinc-200'
              }`}
            />
          </div>
        </div>

        {/* Why this assessment paragraph */}
        <div className="mt-5 rounded-xl bg-zinc-50/80 p-4 border border-zinc-100 text-xs sm:text-sm text-zinc-700 leading-relaxed">
          <span className="font-bold text-zinc-900 block mb-1">Why this assessment?</span>
          {triage.explanation}
        </div>

        {/* Matched Indicators Quick Summary */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-500">Matched Clinical Signals:</span>
          {triage.indicators
            .filter((i) => i.matched === true)
            .map((ind) => (
              <span
                key={ind.id}
                className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-medium text-teal-800"
              >
                <Check className="h-3 w-3 text-teal-600" />
                {ind.label}
              </span>
            ))}
        </div>
      </div>

      {/* SECTION 2: AI-Generated Summary & Recommended Specialty */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* AI Narrative Summary (2 cols) */}
        <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-zinc-900 font-['Space_Grotesk'] uppercase tracking-wider">
                AI Clinical Intake Summary
              </h3>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">{aiSummaryText}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Synthesized from conversational responses & medical documents</span>
            <span className="font-semibold text-teal-700">Verified by Intake Rule Engine</span>
          </div>
        </div>

        {/* Recommended Specialty Card (1 col) */}
        <div className="rounded-2xl border border-teal-200 bg-linear-to-b from-teal-50/70 to-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              Matching Specialty
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              <h3 className="text-lg font-bold text-zinc-900 font-['Space_Grotesk']">
                {recommendedSpecialty}
              </h3>
            </div>
            <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{specialtyRationale}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-teal-100 flex flex-col gap-2">
            <button
              onClick={() => onProceedToDoctors(recommendedSpecialty)}
              className="w-full rounded-xl bg-teal-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition text-center cursor-pointer"
            >
              View Available Doctors
            </button>
            <button
              onClick={() => onProceedToClinics(recommendedSpecialty)}
              className="w-full rounded-xl border border-teal-300 bg-white py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 transition text-center cursor-pointer"
            >
              Browse Clinics
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Structured Patient Data Details */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-zinc-900 font-['Space_Grotesk'] mb-4">
          Structured Clinical Data
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Chief Concern */}
          <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Chief Concern
            </span>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{patientSummary.chiefConcern}</p>
          </div>

          {/* Duration & Pattern */}
          <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Duration & Pattern
            </span>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {patientSummary.duration || 'Not specified'} &bull;{' '}
              {patientSummary.frequency || 'Gradual/Episodic'}
            </p>
          </div>

          {/* Severity */}
          <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-100">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Reported Severity
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base font-bold text-zinc-900">
                {patientSummary.severity ? `${patientSummary.severity} / 10` : 'Not specified'}
              </span>
              {patientSummary.severity && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    patientSummary.severity >= 7
                      ? 'bg-rose-100 text-rose-800'
                      : patientSummary.severity >= 4
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {patientSummary.severity >= 7 ? 'High' : patientSummary.severity >= 4 ? 'Moderate' : 'Mild'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reported Symptoms Cards */}
        {patientSummary.symptoms.length > 0 && (
          <div className="mt-5">
            <span className="text-xs font-bold text-zinc-700 mb-2 block">Reported Symptoms</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {patientSummary.symptoms.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-zinc-200 p-3 bg-white text-xs space-y-1 shadow-2xs"
                >
                  <div className="font-bold text-zinc-900">{s.name}</div>
                  {s.duration && <div className="text-zinc-500">Duration: {s.duration}</div>}
                  {s.severity && <div className="text-zinc-500">Severity: {s.severity}/10</div>}
                  {s.pattern && <div className="text-zinc-500">Pattern: {s.pattern}</div>}
                  {s.notes && <div className="text-zinc-600 italic mt-1">{s.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Associated Symptoms & Medical History */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
              Associated Symptoms
            </span>
            {patientSummary.associatedSymptoms.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patientSummary.associatedSymptoms.map((sym, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-xs text-zinc-800 font-medium"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-400 italic">None reported during interview</span>
            )}
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
              Medical History & Medications
            </span>
            <div className="space-y-1 text-xs text-zinc-700">
              {patientSummary.medicalHistory.length > 0 && (
                <div>
                  <span className="font-semibold text-zinc-900">History: </span>
                  {patientSummary.medicalHistory.join(', ')}
                </div>
              )}
              {patientSummary.medications.length > 0 && (
                <div>
                  <span className="font-semibold text-zinc-900">Medications: </span>
                  {patientSummary.medications.join(', ')}
                </div>
              )}
              {patientSummary.medicalHistory.length === 0 && patientSummary.medications.length === 0 && (
                <span className="text-zinc-400 italic">No prior history or medications disclosed</span>
              )}
            </div>
          </div>
        </div>

        {/* Attached Documents */}
        {documentFindings.length > 0 && (
          <div className="mt-5 pt-4 border-t border-zinc-100">
            <span className="text-xs font-bold text-zinc-700 mb-2 block">Integrated Medical Documents</span>
            <div className="space-y-2">
              {documentFindings.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-teal-200 bg-teal-50/40 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                    <div>
                      <span className="font-bold text-zinc-900">{doc.fileName}</span>
                      <p className="text-zinc-600 text-[11px] mt-0.5">{doc.extractedTextSummary}</p>
                    </div>
                  </div>
                  <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 shrink-0">
                    Source: Uploaded Report
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* "SEE WHY" TRANSPARENT INDICATORS MODAL / DRAWER */}
      {showSeeWhyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 font-['Space_Grotesk']">
                  Transparent Clinical Triage Indicators
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Complete audit checklist of signals considered to determine {triage.category} priority
                </p>
              </div>
              <button
                onClick={() => setShowSeeWhyModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setActiveIndicatorFilter('all')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  activeIndicatorFilter === 'all'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                All Indicators ({triage.indicators.length})
              </button>
              <button
                onClick={() => setActiveIndicatorFilter('matched')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  activeIndicatorFilter === 'matched'
                    ? 'bg-teal-600 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                ✓ Matched ({triage.matchedCount})
              </button>
              <button
                onClick={() => setActiveIndicatorFilter('unmatched')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  activeIndicatorFilter === 'unmatched'
                    ? 'bg-zinc-800 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                ✕ Not Matched / Unknown ({triage.unmatchedCount + triage.unknownCount})
              </button>
            </div>

            {/* Indicator List */}
            <div className="mt-4 overflow-y-auto space-y-2.5 pr-1 flex-1">
              {filteredIndicators.map((ind) => {
                const isMatched = ind.matched === true;
                const isUnmatched = ind.matched === false;
                const isUnknown = ind.matched === null;

                return (
                  <div
                    key={ind.id}
                    className={`rounded-xl border p-3.5 text-xs transition ${
                      isMatched
                        ? 'border-teal-300 bg-teal-50/40'
                        : isUnmatched
                        ? 'border-zinc-200 bg-white'
                        : 'border-dashed border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isMatched
                              ? 'bg-teal-600 text-white'
                              : isUnmatched
                              ? 'bg-zinc-200 text-zinc-600'
                              : 'bg-zinc-100 text-zinc-400'
                          }`}
                        >
                          {isMatched ? '✓' : isUnmatched ? '✕' : '—'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900">{ind.label}</span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase ${
                                isMatched
                                  ? 'bg-teal-100 text-teal-800'
                                  : isUnmatched
                                  ? 'bg-zinc-100 text-zinc-600'
                                  : 'bg-zinc-100 text-zinc-400'
                              }`}
                            >
                              {isMatched ? 'Matched' : isUnmatched ? 'Not Matched' : 'Unavailable'}
                            </span>
                          </div>

                          <p className="mt-1 text-zinc-700 text-xs leading-relaxed">
                            {ind.evidence}
                          </p>
                        </div>
                      </div>

                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 shrink-0 capitalize">
                        Source: {ind.source}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-5 border-t border-zinc-100 pt-4 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                Rule engine configuration follows standard emergency intake scoring.
              </span>
              <button
                onClick={() => setShowSeeWhyModal(false)}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
