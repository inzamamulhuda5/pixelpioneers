import React, { useState } from 'react';
import {
  Appointment,
  AssessmentResult,
  Clinic,
  ConversationMessage,
  DemoScenario,
  Doctor,
  DocumentFinding,
  MetroCity,
  PatientIntakeState,
} from './types';
import { Navbar } from './components/layout/Navbar';
import { DemoControlBar } from './components/common/DemoControlBar';
import { HeroChatComposer } from './components/home/HeroChatComposer';
import { ChatInterface } from './components/chat/ChatInterface';
import { PatientAssessmentView } from './components/assessment/PatientAssessmentView';
import { ClinicDiscoveryView } from './components/clinics/ClinicDiscoveryView';
import { DoctorListView } from './components/doctors/DoctorListView';
import { MyBookingsView } from './components/bookings/MyBookingsView';
import { AssessmentHistoryView } from './components/assessment/AssessmentHistoryView';
import { LiveVoiceModal } from './components/voice/LiveVoiceModal';
import { DocumentUploadModal } from './components/upload/DocumentUploadModal';
import { BookingModal } from './components/booking/BookingModal';
import { BookingConfirmationView } from './components/booking/BookingConfirmationView';

import { initialPatientState, buildAssessment, sendChatMessage } from './services/aiService';
import {
  getAllAppointments,
  simulateSlotConflict,
  resetDemoBookings,
} from './services/bookingStore';
import { CLINICS_DATABASE, DOCTORS_DATABASE } from './data/clinicsAndDoctors';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<
    'home' | 'chat' | 'assessment' | 'clinics' | 'doctors' | 'bookings' | 'history'
  >('home');
  const [selectedCity, setSelectedCity] = useState<MetroCity>('Kolkata');

  // Intake / Chat State
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        "Hello! I am Pixel Pioneers, your AI patient intake and clinic coordination assistant. How are you feeling today? You can describe any symptoms or discomfort you are experiencing.",
      timestamp: 'Just now',
    },
  ]);
  const [patientState, setPatientState] = useState<PatientIntakeState>(initialPatientState);
  const [attachedDocuments, setAttachedDocuments] = useState<DocumentFinding[]>([]);

  // Assessment State
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResult | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentResult[]>([]);
  const [preferredSpecialty, setPreferredSpecialty] = useState<string>('Cardiology');

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [bookingModalData, setBookingModalData] = useState<{
    doctor: Doctor;
    clinic: Clinic;
  } | null>(null);
  const [lastConfirmedBooking, setLastConfirmedBooking] = useState<Appointment | null>(null);

  // Clinic filter for doctor list
  const [doctorClinicFilter, setDoctorClinicFilter] = useState<Clinic | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | undefined>();

  const upcomingBookingsCount = getAllAppointments().filter((a) => a.status === 'confirmed').length;

  // Handler: Start Chat from Home Hero
  const handleStartChatFromHero = (initialText: string) => {
    const userMsg: ConversationMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: initialText,
      timestamp: 'Just now',
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setActiveTab('chat');

    // Trigger AI turn
    sendChatMessage(newMsgs, patientState).then((result) => {
      setPatientState(result.updatedState);
      const aiMsg: ConversationMessage = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: result.reply,
        timestamp: 'Just now',
        isCompletePrompt: result.isComplete,
        quickReplies: result.quickReplies,
      };
      setMessages([...newMsgs, aiMsg]);
    });
  };

  // Handler: Load Demo Scenario
  const handleLoadDemoScenario = (scenario: DemoScenario) => {
    const pState = scenario.patientState || scenario.intakeState!;
    const city = scenario.suggestedCity || scenario.city || 'Kolkata';
    const docs = scenario.sampleDocument
      ? [scenario.sampleDocument]
      : scenario.documentFindings || [];

    setActiveScenarioId(scenario.id);
    setSelectedCity(city);
    setPatientState(pState);
    setAttachedDocuments(docs);

    // Build assessment
    const assess = buildAssessment(pState, docs);
    setCurrentAssessment(assess);
    setAssessmentHistory((prev) => [assess, ...prev.filter((a) => a.id !== assess.id)]);
    setPreferredSpecialty(assess.recommendedSpecialty);

    // Create realistic chat log for evaluator
    const scenarioMsgs: ConversationMessage[] = [
      {
        id: 'sc-1',
        role: 'assistant',
        content:
          "Hello! I am Pixel Pioneers, your AI patient intake assistant. How are you feeling today?",
        timestamp: '10:00 AM',
      },
      {
        id: 'sc-2',
        role: 'user',
        content: `I am having ${pState.chiefConcern}. Started ${pState.duration || 'recently'}.`,
        timestamp: '10:01 AM',
      },
      {
        id: 'sc-3',
        role: 'assistant',
        content:
          'Thank you for providing those details. Could you rate the intensity from 1 to 10 and mention any associated sensations?',
        timestamp: '10:01 AM',
      },
      {
        id: 'sc-4',
        role: 'user',
        content: `It is around ${pState.severity}/10 pain. ${pState.associatedSymptoms.join(', ')}.`,
        timestamp: '10:02 AM',
      },
      {
        id: 'sc-5',
        role: 'assistant',
        content:
          'I have gathered enough information to prepare your health summary. You can review it below and attach a prescription or report if you would like.',
        timestamp: '10:02 AM',
        isCompletePrompt: true,
      },
    ];

    setMessages(scenarioMsgs);
    setActiveTab('assessment');
  };

  // Handler: Complete Intake from Chat / Voice
  const handleCompleteIntake = (overrideState?: PatientIntakeState) => {
    const finalState = overrideState || patientState;
    const assessment = buildAssessment(finalState, attachedDocuments);
    setCurrentAssessment(assessment);
    setPreferredSpecialty(assessment.recommendedSpecialty);
    setAssessmentHistory((prev) => [assessment, ...prev.filter((a) => a.id !== assessment.id)]);
    setActiveTab('assessment');
  };

  // Handler: Reset Demo & State
  const handleResetDemo = () => {
    resetDemoBookings();
    setPatientState(initialPatientState);
    setAttachedDocuments([]);
    setCurrentAssessment(null);
    setActiveScenarioId(undefined);
    setMessages([
      {
        id: 'init-' + Date.now(),
        role: 'assistant',
        content:
          "Hello! I am Pixel Pioneers, your AI patient intake and clinic coordination assistant. How are you feeling today? You can describe any symptoms or discomfort you are experiencing.",
        timestamp: 'Just now',
      },
    ]);
    setActiveTab('home');
  };

  // Handler: Open Booking Modal
  const handleStartBookingForDoctor = (doctor: Doctor) => {
    const matchedClinic = CLINICS_DATABASE.find((c) => c.id === doctor.clinicId) || CLINICS_DATABASE[0];
    setBookingModalData({
      doctor,
      clinic: matchedClinic,
    });
  };

  const handleStartBookingForClinic = (clinic: Clinic) => {
    const doctorInClinic = DOCTORS_DATABASE.find((d) => d.clinicId === clinic.id) || DOCTORS_DATABASE[0];
    setBookingModalData({
      doctor: doctorInClinic,
      clinic,
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-['Plus_Jakarta_Sans'] selection:bg-teal-500 selection:text-white">
      {/* Demo Environment Control Bar */}
      <DemoControlBar
        onLoadScenario={handleLoadDemoScenario}
        onResetDemo={handleResetDemo}
        onSimulateConflict={() => simulateSlotConflict()}
        activeScenarioId={activeScenarioId}
      />

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCity={selectedCity}
        setSelectedCity={setSelectedCity}
        hasActiveAssessment={Boolean(currentAssessment)}
        upcomingBookingsCount={upcomingBookingsCount}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {/* VIEW 1: HOME */}
        {activeTab === 'home' && (
          <HeroChatComposer
            onStartChat={handleStartChatFromHero}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onOpenUpload={() => setIsUploadModalOpen(true)}
            onSelectDemo={handleLoadDemoScenario}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {/* VIEW 2: AI CHAT INTAKE */}
        {activeTab === 'chat' && (
          <div className="pt-4 flex-1">
            <ChatInterface
              messages={messages}
              setMessages={setMessages}
              patientState={patientState}
              setPatientState={setPatientState}
              onOpenVoice={() => setIsVoiceModalOpen(true)}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onCompleteIntake={() => handleCompleteIntake()}
              onResetChat={handleResetDemo}
              attachedDocuments={attachedDocuments}
            />
          </div>
        )}

        {/* VIEW 3: PATIENT ASSESSMENT */}
        {activeTab === 'assessment' && currentAssessment && (
          <PatientAssessmentView
            assessment={currentAssessment}
            onProceedToClinics={(specialty) => {
              setPreferredSpecialty(specialty);
              setActiveTab('clinics');
            }}
            onProceedToDoctors={(specialty) => {
              setPreferredSpecialty(specialty);
              setActiveTab('doctors');
            }}
            onAttachMoreDocuments={() => setIsUploadModalOpen(true)}
          />
        )}

        {/* VIEW 4: CLINIC DISCOVERY */}
        {activeTab === 'clinics' && (
          <ClinicDiscoveryView
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            preferredSpecialty={preferredSpecialty}
            onSelectClinic={handleStartBookingForClinic}
            onSelectDoctorForClinic={(clinic) => {
              setDoctorClinicFilter(clinic);
              setActiveTab('doctors');
            }}
          />
        )}

        {/* VIEW 5: DOCTOR LIST */}
        {activeTab === 'doctors' && (
          <DoctorListView
            selectedCity={selectedCity}
            selectedClinicFilter={doctorClinicFilter}
            onClearClinicFilter={() => setDoctorClinicFilter(null)}
            preferredSpecialty={preferredSpecialty}
            onBookDoctor={handleStartBookingForDoctor}
          />
        )}

        {/* VIEW 6: MY BOOKINGS */}
        {activeTab === 'bookings' && (
          <MyBookingsView
            onStartNewBooking={() => {
              setActiveTab('clinics');
            }}
          />
        )}

        {/* VIEW 7: ASSESSMENTS HISTORY */}
        {activeTab === 'history' && (
          <AssessmentHistoryView
            assessments={assessmentHistory}
            onSelectAssessment={(a) => {
              setCurrentAssessment(a);
              setActiveTab('assessment');
            }}
            onStartNewIntake={() => {
              setPatientState(initialPatientState);
              setActiveTab('chat');
            }}
          />
        )}
      </main>

      {/* CONFIRMATION OVERLAY (Shown directly after booking success) */}
      {lastConfirmedBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <BookingConfirmationView
            appointment={lastConfirmedBooking}
            onViewMyBookings={() => {
              setLastConfirmedBooking(null);
              setActiveTab('bookings');
            }}
            onBackToHome={() => {
              setLastConfirmedBooking(null);
              setActiveTab('home');
            }}
          />
        </div>
      )}

      {/* LIVE VOICE MODAL */}
      <LiveVoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSwitchToText={() => {
          setIsVoiceModalOpen(false);
          setActiveTab('chat');
        }}
        onCompleteIntake={(finalState) => {
          setIsVoiceModalOpen(false);
          handleCompleteIntake(finalState);
        }}
        currentPatientState={patientState}
        messages={messages}
        setMessages={setMessages}
        setPatientState={setPatientState}
        attachedDocuments={attachedDocuments}
        setAttachedDocuments={setAttachedDocuments}
      />

      {/* DOCUMENT UPLOAD & OCR MODAL */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDocumentProcessed={(doc) => {
          setAttachedDocuments((prev) => [...prev, doc]);
          // Add notification message to chat
          const attachmentMsg: ConversationMessage = {
            id: 'doc-msg-' + Date.now(),
            role: 'assistant',
            content: `I've attached and reviewed your document: "${doc.fileName}". Extracted findings have been integrated into your patient profile.`,
            timestamp: 'Just now',
          };
          setMessages((prev) => [...prev, attachmentMsg]);
        }}
        existingDocuments={attachedDocuments}
      />

      {/* BOOKING SCHEDULER MODAL */}
      {bookingModalData && (
        <BookingModal
          isOpen={Boolean(bookingModalData)}
          onClose={() => setBookingModalData(null)}
          doctor={bookingModalData.doctor}
          clinic={bookingModalData.clinic}
          patientChiefConcern={patientState.chiefConcern}
          triageCategory={currentAssessment?.triage.category || 'LOW'}
          onBookingSuccess={(appt) => {
            setLastConfirmedBooking(appt);
            setBookingModalData(null);
          }}
        />
      )}

      {/* Global Clinical & Prototype Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-bold text-zinc-800 font-['Space_Grotesk']">PIXEL PIONEERS</span>
              <span className="text-zinc-300">&bull;</span>
              <span className="text-teal-700 font-medium">Healthcare Intake & Discovery Network</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">
              Prototype for evaluation purposes &bull; Demonstrating conversational AI triage, transparent indicators, and clinic booking.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-zinc-400">
            <span>Emergency Hotline: <strong>102 / 112</strong></span>
            <span>&bull;</span>
            <span>7 Metro Regions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
