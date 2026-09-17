import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Paperclip,
  Square,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ConversationMessage, DocumentFinding, PatientIntakeState } from '../../types';
import { sendChatMessage, analyzeUploadedDocument, determineNextQuestion } from '../../services/aiService';

export type VoiceSessionState =
  | 'IDLE'
  | 'AI_THINKING'
  | 'AI_SPEAKING'
  | 'READY_TO_SPEAK'
  | 'USER_HOLDING'
  | 'USER_SPEAKING'
  | 'PROCESSING'
  | 'ENDING'
  | 'ENDED'
  | 'ERROR';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToText: () => void;
  onCompleteIntake: (finalState: PatientIntakeState) => void;
  currentPatientState: PatientIntakeState;
  messages: ConversationMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>;
  setPatientState: React.Dispatch<React.SetStateAction<PatientIntakeState>>;
  attachedDocuments?: DocumentFinding[];
  setAttachedDocuments?: React.Dispatch<React.SetStateAction<DocumentFinding[]>>;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  onSwitchToText,
  onCompleteIntake,
  currentPatientState,
  messages,
  setMessages,
  setPatientState,
  attachedDocuments = [],
  setAttachedDocuments,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceSessionState>('IDLE');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [lastAiSpoken, setLastAiSpoken] = useState<string>(
    'Hello, I am Pixel Pioneers. Tell me what health symptoms you are experiencing.'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(25);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // Session & Reference State
  const activeSessionId = useRef<string | null>(null);
  const voiceStateRef = useRef<VoiceSessionState>('IDLE');
  const isHoldingRef = useRef<boolean>(false);
  const currentTranscriptRef = useRef<string>('');

  // Timers & Controllers
  const fallbackSpeechEndTimerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio & Speech Synthesis/Recognition
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep state ref strictly synchronized
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  // Safe Helper: Shut down mic capture completely (Hardware track disable + STT abort)
  const stopMicrophoneCapture = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
  };

  // Safe Helper: Activate mic capture (Hardware track enable + STT start)
  const startMicrophoneCapture = (sessionId: string) => {
    if (activeSessionId.current !== sessionId) return;

    // Enable mic track
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    // Initialize or restart SpeechRecognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        if (activeSessionId.current !== sessionId || !isHoldingRef.current) return;

        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          interim += event.results[i][0].transcript;
        }

        const trimmed = interim.trim();
        if (trimmed) {
          currentTranscriptRef.current = trimmed;
          setLiveTranscript(trimmed);

          if (voiceStateRef.current !== 'USER_SPEAKING') {
            setVoiceState('USER_SPEAKING');
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setIsSpeechSupported(false);
          setStatusMessage('Microphone access is needed for voice intake.');
        }
      };

      recognition.onend = () => {
        // If recognition closed while user is still physically holding, auto-restart
        if (activeSessionId.current === sessionId && isHoldingRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsSpeechSupported(false);
    }
  };

  // Initialize Voice Session on Modal Open
  useEffect(() => {
    if (!isOpen) return;

    const sessionId = crypto.randomUUID();
    activeSessionId.current = sessionId;
    setVoiceState('IDLE');
    setLiveTranscript('');
    setStatusMessage('');
    setShowFullTranscript(false);

    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }

    // Hardware Audio Stream Request with strict Echo Cancellation and Noise Suppression
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        .then((stream) => {
          if (activeSessionId.current !== sessionId) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          mediaStreamRef.current = stream;
          // Keep hardware tracks disabled by default
          stream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        })
        .catch(() => {
          // Sandboxed environment / permission prompt denied
        });
    }

    // Orb wave animation
    let angle = 0;
    const animateWave = () => {
      angle += 0.05;
      const state = voiceStateRef.current;
      const base =
        state === 'AI_SPEAKING'
          ? 65
          : state === 'USER_SPEAKING'
          ? 70
          : state === 'USER_HOLDING'
          ? 40
          : state === 'PROCESSING' || state === 'AI_THINKING'
          ? 30
          : 15;
      const flux = Math.sin(angle) * 12 + Math.cos(angle * 1.6) * 6;
      setAudioLevel(Math.max(10, Math.min(95, base + flux)));
      animFrameRef.current = requestAnimationFrame(animateWave);
    };
    animFrameRef.current = requestAnimationFrame(animateWave);

    // Initial greeting after mount
    const initialGreeting =
      messages.length > 1
        ? messages[messages.length - 1].content
        : 'Hello, I am Pixel Pioneers. Tell me what health symptoms you are experiencing.';

    setLastAiSpoken(initialGreeting);

    const greetTimer = setTimeout(() => {
      if (activeSessionId.current === sessionId) {
        speakAiAudio(initialGreeting, sessionId, () => {
          // AI finished speaking -> Transitions to READY_TO_SPEAK (MIC STAYS OFF)
          if (activeSessionId.current === sessionId) {
            setVoiceState('READY_TO_SPEAK');
          }
        });
      }
    }, 150);

    // Cleanup on unmount or close
    return () => {
      clearTimeout(greetTimer);
      if (fallbackSpeechEndTimerRef.current) clearTimeout(fallbackSpeechEndTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();

      if (synthRef.current) {
        synthRef.current.cancel();
      }
      (window as any).__activeUtterance = null;
      currentUtteranceRef.current = null;

      stopMicrophoneCapture();

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      activeSessionId.current = null;
      voiceStateRef.current = 'ENDED';
    };
  }, [isOpen]);

  // Speak AI Audio Output with 100% microphone mute protection
  const speakAiAudio = (
    text: string,
    sessionId: string,
    onComplete?: () => void
  ) => {
    if (activeSessionId.current !== sessionId) return;
    if (voiceStateRef.current === 'ENDED' || voiceStateRef.current === 'ENDING') return;

    // 1. HARD STOP MICROPHONE BEFORE ANY SOUND IS EMITTED
    stopMicrophoneCapture();

    setVoiceState('AI_SPEAKING');
    setStatusMessage('');

    if (!synthRef.current || isMuted) {
      // If muted or TTS unavailable in sandbox, brief delay then finish
      const simulatedTime = Math.max(1200, Math.min(2800, (text.split(' ').length / 3) * 1000));
      setTimeout(() => {
        if (activeSessionId.current === sessionId && voiceStateRef.current === 'AI_SPEAKING') {
          onComplete?.();
        }
      }, simulatedTime);
      return;
    }

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const friendlyVoice = voices.find(
      (v) =>
        v.name.includes('Natural') ||
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        (v.lang && v.lang.startsWith('en'))
    );
    if (friendlyVoice) utterance.voice = friendlyVoice;

    currentUtteranceRef.current = utterance;
    (window as any).__activeUtterance = utterance;

    let hasHandledCompletion = false;
    const finishSpeech = () => {
      if (hasHandledCompletion) return;
      hasHandledCompletion = true;
      if (fallbackSpeechEndTimerRef.current) {
        clearTimeout(fallbackSpeechEndTimerRef.current);
        fallbackSpeechEndTimerRef.current = null;
      }
      currentUtteranceRef.current = null;
      (window as any).__activeUtterance = null;

      if (activeSessionId.current !== sessionId) return;
      if (voiceStateRef.current === 'ENDED' || voiceStateRef.current === 'ENDING') return;

      onComplete?.();
    };

    utterance.onend = finishSpeech;
    utterance.onerror = finishSpeech;

    const wordCount = text.split(' ').length;
    const maxSpeechDurationMs = Math.max(2500, (wordCount / 2.2) * 1000 + 2000);
    fallbackSpeechEndTimerRef.current = setTimeout(() => {
      finishSpeech();
    }, maxSpeechDurationMs);

    try {
      synthRef.current.speak(utterance);
    } catch {
      finishSpeech();
    }
  };

  // PUSH-TO-TALK: HOLD START
  const handleHoldStart = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }

    const sessionId = activeSessionId.current;
    if (!sessionId) return;
    if (voiceStateRef.current === 'PROCESSING' || voiceStateRef.current === 'AI_THINKING') return;

    // As per Requirement 5: Stop any pending AI speech / TTS immediately
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (fallbackSpeechEndTimerRef.current) {
      clearTimeout(fallbackSpeechEndTimerRef.current);
      fallbackSpeechEndTimerRef.current = null;
    }
    currentUtteranceRef.current = null;
    (window as any).__activeUtterance = null;

    isHoldingRef.current = true;
    currentTranscriptRef.current = '';
    setLiveTranscript('');
    setStatusMessage('');
    setVoiceState('USER_HOLDING');

    // Activate mic and start speech recognition
    startMicrophoneCapture(sessionId);
  };

  // PUSH-TO-TALK: HOLD RELEASE
  const handleHoldEnd = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;

    const sessionId = activeSessionId.current;
    if (!sessionId) return;

    // Stop microphone immediately
    stopMicrophoneCapture();

    const finalSpoken = currentTranscriptRef.current.trim();

    // Noise / empty check (Requirement 25 & 26)
    if (!finalSpoken || finalSpoken.length < 2) {
      setVoiceState('READY_TO_SPEAK');
      setStatusMessage("I didn't hear anything. Hold the button and try again.");
      setLiveTranscript('');
      return;
    }

    // Process user turn
    processUserTurn(finalSpoken, sessionId);
  };

  // Process Completed User Speech
  const processUserTurn = async (spokenText: string, sessionId: string) => {
    if (activeSessionId.current !== sessionId) return;

    setVoiceState('PROCESSING');
    setStatusMessage('');

    const userMsg: ConversationMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: spokenText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentMsgSnapshot = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);

    setVoiceState('AI_THINKING');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await sendChatMessage(currentMsgSnapshot, currentPatientState, {
        signal: abortController.signal,
        isVoice: true,
      });

      if (activeSessionId.current !== sessionId) return;
      if (voiceStateRef.current === 'ENDED' || voiceStateRef.current === 'ENDING') return;

      setPatientState(result.updatedState);

      const aiMsg: ConversationMessage = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCompletePrompt: result.isComplete,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setLastAiSpoken(result.reply);
      setLiveTranscript('');

      if (result.isComplete) {
        speakAiAudio(result.reply, sessionId, () => {
          if (activeSessionId.current === sessionId) {
            setTimeout(() => {
              onCompleteIntake(result.updatedState);
            }, 1000);
          }
        });
      } else {
        speakAiAudio(result.reply, sessionId, () => {
          // AI finishes -> Ready for user to hold when they choose!
          if (activeSessionId.current === sessionId) {
            setVoiceState('READY_TO_SPEAK');
          }
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (activeSessionId.current !== sessionId) return;

      setVoiceState('ERROR');
      setStatusMessage('Voice connection issue. Hold button to try speaking again.');
      setTimeout(() => {
        if (activeSessionId.current === sessionId) {
          setVoiceState('READY_TO_SPEAK');
        }
      }, 1500);
    }
  };

  // Document Attachment during Voice Session
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sessionId = activeSessionId.current;
    if (!sessionId) return;

    stopMicrophoneCapture();
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setVoiceState('PROCESSING');
    setIsUploadingDoc(true);
    setStatusMessage(`Analyzing report: ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const finding = await analyzeUploadedDocument(file, base64Data);

        if (activeSessionId.current !== sessionId) return;

        if (setAttachedDocuments) {
          setAttachedDocuments((prev) => [...prev, finding]);
        }

        const updatedWithDoc: PatientIntakeState = {
          ...currentPatientState,
          medications: Array.from(
            new Set([...currentPatientState.medications, ...(finding.medications || [])])
          ),
          medicalHistory: Array.from(
            new Set([...currentPatientState.medicalHistory, ...(finding.priorConditions || [])])
          ),
          reportedDocuments: [...(currentPatientState.reportedDocuments || []), finding],
        };
        setPatientState(updatedWithDoc);

        const docMsg: ConversationMessage = {
          id: 'doc-' + Date.now(),
          role: 'assistant',
          content: `I've attached and reviewed your medical report: "${file.name}". Findings have been integrated into your profile.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, docMsg]);
        setIsUploadingDoc(false);

        const decision = determineNextQuestion(updatedWithDoc, messages.length + 1, { isVoice: true });
        const spokenReply = `I've reviewed your report: ${file.name}. ${decision.question}`;
        setLastAiSpoken(spokenReply);

        if (decision.isComplete) {
          speakAiAudio(spokenReply, sessionId, () => {
            if (activeSessionId.current === sessionId) {
              setTimeout(() => {
                onCompleteIntake(updatedWithDoc);
              }, 1000);
            }
          });
        } else {
          speakAiAudio(spokenReply, sessionId, () => {
            if (activeSessionId.current === sessionId) {
              setVoiceState('READY_TO_SPEAK');
            }
          });
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingDoc(false);
      setStatusMessage('Could not parse document. Ready to continue.');
      setVoiceState('READY_TO_SPEAK');
    }
  };

  // Hard Stop Button (Immediate termination of audio, STT, and pending requests)
  const handleHardStop = () => {
    activeSessionId.current = null;
    setVoiceState('ENDED');
    voiceStateRef.current = 'ENDED';

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (synthRef.current) {
      synthRef.current.cancel();
    }
    (window as any).__activeUtterance = null;
    currentUtteranceRef.current = null;

    stopMicrophoneCapture();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (fallbackSpeechEndTimerRef.current) clearTimeout(fallbackSpeechEndTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    setLiveTranscript('');
    onClose();
  };

  // Simulated Input for Evaluation / Testing
  const handleSimulatedInput = (samplePhrase: string) => {
    const sessionId = activeSessionId.current;
    if (!sessionId) return;

    if (synthRef.current) {
      synthRef.current.cancel();
    }

    setLiveTranscript(samplePhrase);
    currentTranscriptRef.current = samplePhrase;
    setTimeout(() => {
      if (activeSessionId.current === sessionId) {
        processUserTurn(samplePhrase, sessionId);
      }
    }, 150);
  };

  if (!isOpen) return null;

  // Recent messages for compact preview (maximum 3 recent)
  const recentMessages = messages.slice(-3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-xl p-4 transition-opacity">
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-6 sm:p-7 text-white shadow-2xl border border-zinc-800 flex flex-col items-center justify-between min-h-[580px]">
        {/* Hidden File Input for Medical Reports */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelected}
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
        />

        {/* Top Header Bar */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-2.5 w-2.5 rounded-full ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-teal-400 animate-ping'
                  : voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING'
                  ? 'bg-emerald-400 animate-ping'
                  : voiceState === 'READY_TO_SPEAK'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
              LIVE AI INTAKE VOICE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="rounded-full bg-zinc-800 p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
              title={isMuted ? 'Unmute AI voice output' : 'Mute AI voice output'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={handleHardStop}
              className="rounded-full bg-zinc-800 p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
              title="Close and end call"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Center Animated Glowing AI Orb */}
        <div className="flex flex-col items-center justify-center my-auto py-4">
          <div className="relative flex items-center justify-center">
            {/* Outer Glow Ring */}
            <div
              className={`absolute rounded-full blur-xl transition-all duration-300 ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-teal-500/20'
                  : voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING'
                  ? 'bg-emerald-500/25'
                  : voiceState === 'PROCESSING' || voiceState === 'AI_THINKING'
                  ? 'bg-amber-500/20'
                  : 'bg-zinc-800/40'
              }`}
              style={{
                width: `${140 + audioLevel * 1.4}px`,
                height: `${140 + audioLevel * 1.4}px`,
              }}
            />

            {/* Pulsing Ring */}
            <div
              className={`absolute rounded-full blur-md transition-all duration-200 ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-teal-400/30'
                  : voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING'
                  ? 'bg-emerald-400/35'
                  : voiceState === 'PROCESSING' || voiceState === 'AI_THINKING'
                  ? 'bg-amber-400/25'
                  : 'bg-zinc-700/20'
              }`}
              style={{
                width: `${110 + audioLevel * 1.1}px`,
                height: `${110 + audioLevel * 1.1}px`,
              }}
            />

            {/* Core Circular AI Orb */}
            <div
              className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-transform duration-150 ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-gradient-to-tr from-teal-600 via-teal-400 to-emerald-300 shadow-teal-500/30'
                  : voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING'
                  ? 'bg-gradient-to-tr from-emerald-600 via-emerald-400 to-teal-300 shadow-emerald-500/40'
                  : voiceState === 'PROCESSING' || voiceState === 'AI_THINKING'
                  ? 'bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-300 shadow-amber-500/20'
                  : voiceState === 'READY_TO_SPEAK'
                  ? 'bg-gradient-to-tr from-zinc-700 via-teal-700 to-zinc-600 shadow-teal-500/20'
                  : 'bg-gradient-to-tr from-zinc-800 via-zinc-700 to-zinc-600'
              }`}
              style={{
                transform: `scale(${1 + (audioLevel / 100) * 0.15})`,
              }}
            >
              {voiceState === 'AI_SPEAKING' ? (
                <div className="flex items-center gap-1">
                  <span className="h-5 w-1 rounded-full bg-white animate-bounce" />
                  <span className="h-8 w-1 rounded-full bg-white animate-bounce [animation-delay:0.15s]" />
                  <span className="h-4 w-1 rounded-full bg-white animate-bounce [animation-delay:0.3s]" />
                </div>
              ) : voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING' ? (
                <Mic className="h-7 w-7 text-zinc-950 animate-pulse" />
              ) : voiceState === 'PROCESSING' || voiceState === 'AI_THINKING' ? (
                <Sparkles className="h-7 w-7 text-white animate-spin" />
              ) : voiceState === 'READY_TO_SPEAK' ? (
                <Mic className="h-7 w-7 text-teal-200" />
              ) : (
                <MicOff className="h-7 w-7 text-zinc-400" />
              )}
            </div>
          </div>

          {/* Current Status Indicator */}
          <div className="mt-5 flex items-center gap-2 rounded-full bg-zinc-800/90 px-3.5 py-1 border border-zinc-700">
            {voiceState === 'AI_SPEAKING' && (
              <>
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-semibold text-teal-300">● AI is speaking</span>
              </>
            )}
            {voiceState === 'READY_TO_SPEAK' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-300">● Ready to speak</span>
              </>
            )}
            {voiceState === 'USER_HOLDING' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-semibold text-emerald-300">● Listening... Release when done</span>
              </>
            )}
            {voiceState === 'USER_SPEAKING' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-semibold text-emerald-300">● Listening... Release when done</span>
              </>
            )}
            {(voiceState === 'PROCESSING' || voiceState === 'AI_THINKING') && (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-spin" />
                <span className="text-xs font-semibold text-amber-300">● Understanding...</span>
              </>
            )}
            {voiceState === 'ENDED' && (
              <span className="text-xs font-semibold text-zinc-400">● Voice chat ended</span>
            )}
            {voiceState === 'ERROR' && (
              <>
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-xs font-semibold text-red-400">● Voice connection issue</span>
              </>
            )}
          </div>
        </div>

        {/* Compact Recent Transcript Area (Max 2-3 recent messages, no giant scrolling box) */}
        <div className="w-full text-center px-1 sm:px-2 mb-3 max-w-md">
          <div className="bg-zinc-800/40 border border-zinc-800 rounded-2xl p-3 text-left">
            <div className="flex items-center justify-between mb-1.5 border-b border-zinc-800 pb-1">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Conversation Preview
              </span>
              {messages.length > 2 && (
                <button
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                >
                  {showFullTranscript ? (
                    <>
                      <span>Compact</span>
                      <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <span>View full transcript</span>
                      <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>

            <div
              className={`space-y-2 overflow-y-auto pr-1 transition-all ${
                showFullTranscript ? 'max-h-48' : 'max-h-24'
              }`}
            >
              {(showFullTranscript ? messages : recentMessages).map((m) => (
                <div key={m.id} className="text-xs leading-relaxed">
                  <span
                    className={`font-semibold uppercase tracking-wider text-[10px] block ${
                      m.role === 'assistant' ? 'text-teal-400' : 'text-emerald-400'
                    }`}
                  >
                    {m.role === 'assistant' ? 'AI' : 'You'}
                  </span>
                  <p className="text-zinc-200 mt-0.5">{m.content}</p>
                </div>
              ))}

              {/* Live progressive transcript while user is holding and speaking */}
              {isHoldingRef.current && (
                <div className="text-xs leading-relaxed bg-zinc-800/80 border border-emerald-500/40 rounded-lg p-1.5 mt-1 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-400">
                      You
                    </span>
                    <span className="text-[9px] text-emerald-400 animate-pulse">Live</span>
                  </div>
                  <p className="text-white font-medium mt-0.5">
                    {liveTranscript ? `"${liveTranscript}"` : 'Listening to your voice...'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* User Feedback Status */}
          {statusMessage && (
            <p className="mt-1.5 text-xs font-medium text-teal-300 animate-fade-in">
              {statusMessage}
            </p>
          )}
        </div>

        {/* PRIMARY PUSH-TO-TALK "HOLD TO SPEAK" CONTROL */}
        <div className="w-full max-w-sm flex flex-col items-center mb-3">
          <button
            onPointerDown={handleHoldStart}
            onPointerUp={handleHoldEnd}
            onPointerCancel={handleHoldEnd}
            onPointerLeave={handleHoldEnd}
            onKeyDown={(e) => {
              if (e.code === 'Space' || e.key === ' ') {
                if (!e.repeat) {
                  e.preventDefault();
                  handleHoldStart();
                }
              }
            }}
            onKeyUp={(e) => {
              if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                handleHoldEnd();
              }
            }}
            disabled={
              voiceState === 'PROCESSING' ||
              voiceState === 'AI_THINKING' ||
              voiceState === 'ENDED'
            }
            tabIndex={0}
            aria-label="Hold to speak"
            className={`w-full select-none touch-none flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl font-semibold text-sm transition-all duration-150 shadow-lg ${
              voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 ring-4 ring-emerald-500/30 scale-[0.98]'
                : voiceState === 'AI_SPEAKING'
                ? 'bg-zinc-800 text-teal-300/80 border border-teal-800/50 cursor-pointer'
                : voiceState === 'PROCESSING' || voiceState === 'AI_THINKING'
                ? 'bg-zinc-800 text-amber-300/70 border border-amber-800/40 cursor-wait'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-zinc-950 ring-2 ring-teal-400/20 active:scale-[0.98] cursor-pointer'
            }`}
          >
            {voiceState === 'USER_HOLDING' || voiceState === 'USER_SPEAKING' ? (
              <>
                <Mic className="h-5 w-5 animate-pulse text-zinc-950" />
                <span>Listening... Release when done</span>
              </>
            ) : voiceState === 'AI_SPEAKING' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                <span>AI is speaking (Press & hold to speak)</span>
              </>
            ) : voiceState === 'PROCESSING' || voiceState === 'AI_THINKING' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 text-zinc-950" />
                <span>HOLD TO SPEAK</span>
              </>
            )}
          </button>

          <span className="text-[10px] text-zinc-500 mt-1.5">
            Press and hold while speaking • Release to send
          </span>
        </div>

        {/* Attach Report & Evaluation Simulation Controls */}
        <div className="w-full flex flex-col items-center gap-2 mb-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingDoc}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-teal-300 bg-zinc-800 hover:bg-zinc-700 px-3.5 py-1.5 rounded-full border border-zinc-700 transition disabled:opacity-50"
          >
            {isUploadingDoc ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
            ) : (
              <Paperclip className="h-3.5 w-3.5 text-teal-400" />
            )}
            <span>{isUploadingDoc ? 'Analyzing Report...' : 'Attach Medical Report (PDF/JPG)'}</span>
          </button>

          {/* Quick Simulation Chips for Evaluation */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-zinc-500">Quick simulation:</span>
            <button
              onClick={() => handleSimulatedInput('I have chest tightness and cold sweats')}
              className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-teal-300 hover:bg-zinc-700 transition"
            >
              "Chest tightness & sweat"
            </button>
            <button
              onClick={() => handleSimulatedInput('Started 2 days ago, around 6 out of 10')}
              className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-teal-300 hover:bg-zinc-700 transition"
            >
              "2 days ago, 6/10"
            </button>
          </div>

          {!isSpeechSupported && (
            <div className="flex items-center justify-center gap-1 text-[11px] text-amber-400/90 mt-0.5">
              <AlertCircle className="h-3 w-3" />
              <span>Microphone sandbox restriction; use quick simulation chips or switch to text</span>
            </div>
          )}
        </div>

        {/* Bottom Control Actions with Hard Stop Button */}
        <div className="w-full flex items-center justify-between border-t border-zinc-800 pt-3">
          <button
            onClick={() => {
              handleHardStop();
              onSwitchToText();
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <MessageSquare className="h-4 w-4 text-zinc-400" />
            <span>Switch to Text Chat</span>
          </button>

          <button
            onClick={handleHardStop}
            className="flex items-center gap-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/80 px-3.5 py-1.5 text-xs font-semibold transition"
          >
            <Square className="h-3.5 w-3.5 fill-red-400 text-red-400" />
            <span>End Voice Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
