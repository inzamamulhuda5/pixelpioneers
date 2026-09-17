import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  User,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ConversationMessage, DocumentFinding, PatientIntakeState } from '../../types';
import { sendChatMessage } from '../../services/aiService';

interface ChatInterfaceProps {
  messages: ConversationMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>;
  patientState: PatientIntakeState;
  setPatientState: React.Dispatch<React.SetStateAction<PatientIntakeState>>;
  onOpenVoice: () => void;
  onOpenUpload: () => void;
  onCompleteIntake: () => void;
  onResetChat: () => void;
  attachedDocuments: DocumentFinding[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  setMessages,
  patientState,
  setPatientState,
  onOpenVoice,
  onOpenUpload,
  onCompleteIntake,
  onResetChat,
  attachedDocuments,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    'Started yesterday',
    'Around 6/10 pain',
    'Comes and goes',
    'Worse with activity',
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: ConversationMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await sendChatMessage(newMessages, patientState);
      setPatientState(result.updatedState);

      const aiMsg: ConversationMessage = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCompletePrompt: result.isComplete,
        quickReplies: result.quickReplies,
      };

      setMessages([...newMessages, aiMsg]);
      if (result.quickReplies) {
        setQuickReplies(result.quickReplies);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check how many intake fields are answered for the progress pill
  const hasConcern = Boolean(patientState.chiefConcern);
  const hasTiming = Boolean(patientState.duration);
  const hasSeverity = patientState.severity !== null;
  const hasTriggers = patientState.triggers.length > 0 || Boolean(patientState.frequency);
  const answeredCount = [hasConcern, hasTiming, hasSeverity, hasTriggers].filter(Boolean).length;
  const isReadyForAssessment = answeredCount >= 3 || messages.some((m) => m.isCompletePrompt);

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-4xl mx-auto w-full px-2 sm:px-4 pb-4">
      {/* Intake Progress & Safety Disclaimer Banner */}
      <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-bold text-zinc-900 font-['Space_Grotesk']">
              Structured Clinical Interview
            </span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
              {answeredCount}/4 Signals Collected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isReadyForAssessment && (
              <button
                onClick={onCompleteIntake}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 transition cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>View Assessment</span>
              </button>
            )}

            <button
              onClick={onResetChat}
              className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mini signals checklist */}
        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
              hasConcern ? 'bg-teal-50 text-teal-800 font-medium' : 'bg-zinc-50 text-zinc-400'
            }`}
          >
            <CheckCircle2 className={`h-3 w-3 ${hasConcern ? 'text-teal-600' : 'text-zinc-300'}`} />
            <span>Chief Concern</span>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
              hasTiming ? 'bg-teal-50 text-teal-800 font-medium' : 'bg-zinc-50 text-zinc-400'
            }`}
          >
            <CheckCircle2 className={`h-3 w-3 ${hasTiming ? 'text-teal-600' : 'text-zinc-300'}`} />
            <span>Timing / Duration</span>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
              hasSeverity ? 'bg-teal-50 text-teal-800 font-medium' : 'bg-zinc-50 text-zinc-400'
            }`}
          >
            <CheckCircle2 className={`h-3 w-3 ${hasSeverity ? 'text-teal-600' : 'text-zinc-300'}`} />
            <span>Severity (1-10)</span>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
              hasTriggers ? 'bg-teal-50 text-teal-800 font-medium' : 'bg-zinc-50 text-zinc-400'
            }`}
          >
            <CheckCircle2 className={`h-3 w-3 ${hasTriggers ? 'text-teal-600' : 'text-zinc-300'}`} />
            <span>Triggers / Context</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-zinc-900 text-teal-400 shadow-2xs mt-1">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-zinc-900 text-white rounded-br-xs'
                    : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-xs shadow-2xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* If AI concluded intake, show call to action */}
                {msg.isCompletePrompt && (
                  <div className="mt-3.5 rounded-xl border border-teal-200 bg-teal-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="text-xs text-teal-900">
                      <span className="font-bold block">Patient Assessment Prepared</span>
                      <span>Review your transparent triage indicators and find relevant clinics.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onOpenUpload}
                        className="rounded-lg bg-white border border-teal-300 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition cursor-pointer"
                      >
                        Attach Report
                      </button>
                      <button
                        onClick={onCompleteIntake}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Assessment</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}

                <span
                  className={`mt-1.5 block text-[10px] ${
                    isUser ? 'text-zinc-400 text-right' : 'text-zinc-400'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {isUser && (
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-teal-600 text-white shadow-2xs mt-1">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-teal-400">
              <Sparkles className="h-4 w-4 animate-spin" />
            </div>
            <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-xs text-zinc-500 shadow-2xs flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.15s]" />
              <span className="h-2 w-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.3s]" />
              <span className="ml-1 text-zinc-600 font-medium">Reviewing your symptoms...</span>
            </div>
          </div>
        )}

        {/* Attached Reports Preview in Chat */}
        {attachedDocuments.length > 0 && (
          <div className="flex justify-start pl-11">
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2 text-xs text-teal-900 flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 text-teal-600" />
              <span className="font-semibold">Attached:</span>
              <span>{attachedDocuments.map((d) => d.fileName).join(', ')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Replies */}
      {quickReplies.length > 0 && !isLoading && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 py-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Suggested:</span>
          {quickReplies.map((reply, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (reply === 'View My Assessment') {
                  onCompleteIntake();
                } else if (reply === 'Attach a Report') {
                  onOpenUpload();
                } else {
                  handleSendMessage(reply);
                }
              }}
              className="rounded-full bg-white border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-800 transition cursor-pointer active:scale-95 shadow-2xs font-medium"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input Composer Box */}
      <div className="mt-2 rounded-2xl border border-zinc-300 bg-white p-2.5 shadow-md focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={onOpenUpload}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-teal-600 transition cursor-pointer"
            title="Attach PDF or prescription image"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onOpenVoice}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-teal-600 transition cursor-pointer"
            title="Live voice mode"
          >
            <Mic className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your response or describe what you feel..."
            className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white shadow-2xs hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
