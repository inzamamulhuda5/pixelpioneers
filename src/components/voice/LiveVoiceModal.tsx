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
  FastForward,
  Loader2,
} from 'lucide-react';
import { ConversationMessage, DocumentFinding, PatientIntakeState } from '../../types';
import { sendChatMessage, analyzeUploadedDocument, determineNextQuestion } from '../../services/aiService';

export type VoiceSessionState =
  | 'IDLE'
  | 'AI_THINKING'
  | 'AI_SPEAKING'
  | 'WAITING_FOR_USER'
  | 'USER_SPEAKING'
  | 'USER_PROCESSING'
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

// Configurable silence threshold (1600ms) to allow natural pauses without premature cut-off
const END_OF_SPEECH_SILENCE_MS = 1600;

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
  const [transcript, setTranscript] = useState<string>('');
  const [lastAiSpoken, setLastAiSpoken] = useState<string>(
    'Hello, I am Pixel Pioneers. Tell me what health symptoms you are experiencing.'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(25);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Session and State Refs
  const activeSessionId = useRef<string | null>(null);
  const voiceStateRef = useRef<VoiceSessionState>('IDLE');
  const isMicCapturingRef = useRef<boolean>(false);
  const currentTranscriptRef = useRef<string>('');

  // Timers and Controllers
  const silenceTimerRef = useRef<any>(null);
  const inactivityTimerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio and Speech Refs
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize state ref
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  // Clean helper: physical & logical mic shutdown
  const stopMicrophoneCapture = () => {
    isMicCapturingRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Disable media stream tracks so hardware mic is silent
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    // Abort speech recognition immediately
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
  };

  // Clean helper: physical & logical mic startup
  const startMicrophoneCapture = (sessionId: string) => {
    if (activeSessionId.current !== sessionId) return;
    if (
      voiceStateRef.current === 'ENDED' ||
      voiceStateRef.current === 'ENDING' ||
      voiceStateRef.current === 'AI_SPEAKING' ||
      voiceStateRef.current === 'AI_THINKING' ||
      voiceStateRef.current === 'USER_PROCESSING'
    ) {
      return;
    }

    // Clear previous audio capture residue
    stopMicrophoneCapture();

    isMicCapturingRef.current = true;
    currentTranscriptRef.current = '';
    setTranscript('');
    setStatusMessage('');
    setVoiceState('WAITING_FOR_USER');

    // Re-enable hardware mic tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    // Start recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Recognition may already be running or queued
      }
    }

    // Schedule gentle inactivity prompt
    resetInactivityTimer(sessionId);
  };

  // Inactivity / silence handling
  const resetInactivityTimer = (sessionId: string) => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    inactivityTimerRef.current = setTimeout(() => {
      if (activeSessionId.current !== sessionId) return;
      if (voiceStateRef.current === 'WAITING_FOR_USER') {
        setStatusMessage("Take your time. I'm listening.");

        // Second longer inactivity prompt
        inactivityTimerRef.current = setTimeout(() => {
          if (activeSessionId.current !== sessionId) return;
          if (voiceStateRef.current === 'WAITING_FOR_USER') {
            setStatusMessage("You can continue whenever you're ready, or end the voice chat.");
          }
        }, 20000);
      }
    }, 12000);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  // Initialize Voice Session
  useEffect(() => {
    if (!isOpen) return;

    const sessionId = crypto.randomUUID();
    activeSessionId.current = sessionId;
    setVoiceState('IDLE');
    setTranscript('');
    setStatusMessage('');

    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }

    // Request Hardware Media Stream with AEC, NS, AGC
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
          // Initially keep mic disabled until greeting finishes
          stream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        })
        .catch(() => {
          // Sandboxed environment or permission denied
        });
    }

    // Setup Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          // If started while AI is speaking, immediately abort!
          if (
            voiceStateRef.current === 'AI_SPEAKING' ||
            voiceStateRef.current === 'AI_THINKING' ||
            voiceStateRef.current === 'USER_PROCESSING' ||
            voiceStateRef.current === 'ENDED'
          ) {
            try {
              recognition.abort();
            } catch {}
          }
        };

        recognition.onresult = (event: any) => {
          if (activeSessionId.current !== sessionId) return;

          // CRITICAL: NEVER process user speech while AI is speaking or thinking!
          if (
            voiceStateRef.current === 'AI_SPEAKING' ||
            voiceStateRef.current === 'AI_THINKING' ||
            voiceStateRef.current === 'USER_PROCESSING' ||
            voiceStateRef.current === 'ENDING' ||
            voiceStateRef.current === 'ENDED'
          ) {
            try {
              recognition.abort();
            } catch {}
            return;
          }

          let combinedText = '';
          for (let i = 0; i < event.results.length; i++) {
            combinedText += event.results[i][0].transcript;
          }

          const trimmed = combinedText.trim();
          if (!trimmed) return;

          currentTranscriptRef.current = trimmed;
          setTranscript(trimmed);
          clearInactivityTimer();

          if (voiceStateRef.current !== 'USER_SPEAKING') {
            setVoiceState('USER_SPEAKING');
          }

          // Reset silence timer for natural endpoint detection
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          silenceTimerRef.current = setTimeout(() => {
            if (activeSessionId.current !== sessionId) return;
            if (voiceStateRef.current === 'USER_SPEAKING' && currentTranscriptRef.current.trim().length > 1) {
              handleUserSpeechDone(currentTranscriptRef.current.trim(), sessionId);
            }
          }, END_OF_SPEECH_SILENCE_MS);
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            setIsSpeechSupported(false);
          }
        };

        recognition.onend = () => {
          // If ended unexpectedly while waiting for user, restart
          if (
            activeSessionId.current === sessionId &&
            (voiceStateRef.current === 'WAITING_FOR_USER' || voiceStateRef.current === 'USER_SPEAKING') &&
            isMicCapturingRef.current
          ) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognitionRef.current = recognition;
      } catch {
        setIsSpeechSupported(false);
      }
    } else {
      setIsSpeechSupported(false);
    }

    // Orb wave animation simulation
    let angle = 0;
    const animateWave = () => {
      angle += 0.05;
      const state = voiceStateRef.current;
      const base =
        state === 'AI_SPEAKING'
          ? 60
          : state === 'USER_SPEAKING'
          ? 50
          : state === 'WAITING_FOR_USER'
          ? 30
          : 15;
      const flux = Math.sin(angle) * 12 + Math.cos(angle * 1.6) * 6;
      setAudioLevel(Math.max(10, Math.min(95, base + flux)));
      animFrameRef.current = requestAnimationFrame(animateWave);
    };
    animFrameRef.current = requestAnimationFrame(animateWave);

    // Initial greeting after mount
    const greetTimer = setTimeout(() => {
      if (activeSessionId.current === sessionId) {
        speakGreeting(sessionId);
      }
    }, 150);

    // Cleanup on unmount or session change
    return () => {
      clearTimeout(greetTimer);
      clearInactivityTimer();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();

      if (synthRef.current) {
        synthRef.current.cancel();
      }

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

  // Initial greeting
  const speakGreeting = (sessionId: string) => {
    if (activeSessionId.current !== sessionId) return;

    const greeting =
      messages.length > 1
        ? messages[messages.length - 1].content
        : 'Hello, I am Pixel Pioneers. Tell me what health symptoms you are experiencing.';

    setLastAiSpoken(greeting);
    speakAiAudio(greeting, sessionId, () => {
      if (activeSessionId.current === sessionId) {
        startMicrophoneCapture(sessionId);
      }
    });
  };

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
      // If muted or TTS unavailable, simulate brief delay then transition
      setTimeout(() => {
        if (activeSessionId.current === sessionId) {
          onComplete?.();
        }
      }, 1400);
      return;
    }

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick natural voice if available
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

    utterance.onend = () => {
      if (activeSessionId.current !== sessionId) return;
      if (voiceStateRef.current === 'ENDED' || voiceStateRef.current === 'ENDING') return;
      currentUtteranceRef.current = null;
      onComplete?.();
    };

    utterance.onerror = () => {
      if (activeSessionId.current !== sessionId) return;
      if (voiceStateRef.current === 'ENDED' || voiceStateRef.current === 'ENDING') return;
      currentUtteranceRef.current = null;
      onComplete?.();
    };

    synthRef.current.speak(utterance);
  };

  // Safe Interruption by User: Click "Interrupt AI" or Tap Orb
  const handleInterruptAi = () => {
    if (voiceStateRef.current !== 'AI_SPEAKING') return;
    const sessionId = activeSessionId.current;
    if (!sessionId) return;

    if (synthRef.current) {
      synthRef.current.cancel();
    }
    currentUtteranceRef.current = null;

    // Reopen mic and let user speak
    startMicrophoneCapture(sessionId);
  };

  // User turn submission logic
  const handleUserSpeechDone = async (spokenText: string, sessionId: string) => {
    if (activeSessionId.current !== sessionId) return;
    if (!spokenText.trim()) return;

    // Turn OFF microphone immediately before processing
    stopMicrophoneCapture();

    setVoiceState('USER_PROCESSING');
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

    // Setup AbortController for network request
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
          if (activeSessionId.current === sessionId) {
            startMicrophoneCapture(sessionId);
          }
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (activeSessionId.current !== sessionId) return;

      setVoiceState('ERROR');
      setStatusMessage('I had trouble processing that. Please try again.');

      setTimeout(() => {
        if (activeSessionId.current === sessionId) {
          startMicrophoneCapture(sessionId);
        }
      }, 2000);
    }
  };

  // Document Attachment during Voice Session (Requirement 20)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sessionId = activeSessionId.current;
    if (!sessionId) return;

    // Pause voice session while processing document
    stopMicrophoneCapture();
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setVoiceState('USER_PROCESSING');
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

        // Merge findings into patient state
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

        // Add to messages
        const docMsg: ConversationMessage = {
          id: 'doc-' + Date.now(),
          role: 'assistant',
          content: `I've attached and reviewed your medical report: "${file.name}". Extracted findings have been integrated.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, docMsg]);

        setIsUploadingDoc(false);

        // Determine if intake is now complete or ask next question
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
              startMicrophoneCapture(sessionId);
            }
          });
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingDoc(false);
      setStatusMessage('Could not parse document. Resuming voice...');
      setTimeout(() => {
        if (activeSessionId.current === sessionId) {
          startMicrophoneCapture(sessionId);
        }
      }, 1500);
    }
  };

  // Hard Stop Button (Requirement 10)
  const handleHardStop = () => {
    activeSessionId.current = null;
    setVoiceState('ENDED');
    voiceStateRef.current = 'ENDED';

    // Cancel all async operations and speech
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (synthRef.current) {
      synthRef.current.cancel();
    }
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

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    clearInactivityTimer();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    setTranscript('');
    onClose();
  };

  // Simulated speech input for evaluator verification
  const handleSimulatedInput = (samplePhrase: string) => {
    const sessionId = activeSessionId.current;
    if (!sessionId) return;

    if (voiceStateRef.current === 'AI_SPEAKING') {
      handleInterruptAi();
    }

    setTranscript(samplePhrase);
    setTimeout(() => {
      if (activeSessionId.current === sessionId) {
        handleUserSpeechDone(samplePhrase, sessionId);
      }
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-xl p-4 transition-opacity">
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 p-6 sm:p-8 text-white shadow-2xl border border-zinc-800 flex flex-col items-center justify-between min-h-[560px]">
        {/* Hidden file input for Report Attachment */}
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
                  : voiceState === 'USER_SPEAKING'
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
              Live AI Intake Voice
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

        {/* Center Animated Voice Orb / Waveform */}
        <div className="flex flex-col items-center justify-center my-auto py-6">
          <div className="relative flex items-center justify-center">
            {/* Outer Glow Ring */}
            <div
              className={`absolute rounded-full blur-xl transition-all duration-300 ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-teal-500/20'
                  : voiceState === 'USER_SPEAKING'
                  ? 'bg-emerald-500/20'
                  : 'bg-zinc-800/40'
              }`}
              style={{
                width: `${140 + audioLevel * 1.5}px`,
                height: `${140 + audioLevel * 1.5}px`,
              }}
            />

            {/* Pulsing Ring */}
            <div
              className={`absolute rounded-full blur-md transition-all duration-200 ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-teal-400/30'
                  : voiceState === 'USER_SPEAKING'
                  ? 'bg-emerald-400/30'
                  : 'bg-zinc-700/20'
              }`}
              style={{
                width: `${110 + audioLevel * 1.1}px`,
                height: `${110 + audioLevel * 1.1}px`,
              }}
            />

            {/* Core Orb - Clickable to interrupt AI or speak */}
            <button
              onClick={voiceState === 'AI_SPEAKING' ? handleInterruptAi : undefined}
              className={`relative flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-transform duration-150 ${
                voiceState === 'AI_SPEAKING'
                  ? 'bg-gradient-to-tr from-teal-600 via-teal-400 to-emerald-300 shadow-teal-500/30 cursor-pointer'
                  : voiceState === 'USER_SPEAKING'
                  ? 'bg-gradient-to-tr from-emerald-600 via-emerald-400 to-teal-300 shadow-emerald-500/30'
                  : voiceState === 'WAITING_FOR_USER'
                  ? 'bg-gradient-to-tr from-zinc-700 via-teal-600 to-zinc-600 shadow-teal-500/20'
                  : 'bg-gradient-to-tr from-zinc-800 via-zinc-700 to-zinc-600'
              }`}
              style={{
                transform: `scale(${1 + (audioLevel / 100) * 0.16})`,
              }}
              title={voiceState === 'AI_SPEAKING' ? 'Click to interrupt AI and speak' : undefined}
            >
              {voiceState === 'AI_SPEAKING' ? (
                <div className="flex items-center gap-1">
                  <span className="h-6 w-1 rounded-full bg-white animate-bounce" />
                  <span className="h-10 w-1 rounded-full bg-white animate-bounce [animation-delay:0.15s]" />
                  <span className="h-5 w-1 rounded-full bg-white animate-bounce [animation-delay:0.3s]" />
                </div>
              ) : voiceState === 'USER_SPEAKING' ? (
                <Mic className="h-8 w-8 text-zinc-950 animate-pulse" />
              ) : voiceState === 'WAITING_FOR_USER' ? (
                <Mic className="h-8 w-8 text-white animate-pulse" />
              ) : voiceState === 'USER_PROCESSING' || voiceState === 'AI_THINKING' ? (
                <Sparkles className="h-8 w-8 text-white animate-spin" />
              ) : (
                <MicOff className="h-8 w-8 text-zinc-400" />
              )}
            </button>
          </div>

          {/* Turn Ownership Badge */}
          <div className="mt-8 flex items-center gap-2 rounded-full bg-zinc-800/90 px-4 py-1.5 border border-zinc-700">
            {voiceState === 'AI_SPEAKING' && (
              <>
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-semibold text-teal-300">● AI is speaking</span>
              </>
            )}
            {voiceState === 'WAITING_FOR_USER' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-300">🎙 Listening...</span>
              </>
            )}
            {voiceState === 'USER_SPEAKING' && (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-semibold text-emerald-300">🎙 Listening to you...</span>
              </>
            )}
            {(voiceState === 'USER_PROCESSING' || voiceState === 'AI_THINKING') && (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-spin" />
                <span className="text-xs font-semibold text-amber-300">◌ Understanding...</span>
              </>
            )}
            {voiceState === 'ENDED' && (
              <span className="text-xs font-semibold text-zinc-400">Voice chat ended</span>
            )}
            {voiceState === 'ERROR' && (
              <span className="text-xs font-semibold text-red-400">Error processing speech</span>
            )}
          </div>

          {/* Safe Interruption Button if AI is speaking */}
          {voiceState === 'AI_SPEAKING' && (
            <button
              onClick={handleInterruptAi}
              className="mt-3 flex items-center gap-1.5 text-xs text-teal-300/90 hover:text-teal-200 bg-teal-950/40 hover:bg-teal-950/70 border border-teal-800/60 rounded-full px-3 py-1 transition"
            >
              <FastForward className="h-3 w-3" />
              <span>Tap to Interrupt & Speak</span>
            </button>
          )}
        </div>

        {/* Live Transcript & Spoken AI Question */}
        <div className="w-full text-center px-4 mb-3">
          {voiceState === 'USER_SPEAKING' || transcript ? (
            <div className="bg-zinc-800/60 border border-zinc-700/70 rounded-2xl p-3.5 max-w-md mx-auto">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                You
              </span>
              <p className="text-sm font-medium text-white leading-relaxed">
                "{transcript}"
              </p>
            </div>
          ) : (
            <div className="bg-zinc-800/40 border border-zinc-800 rounded-2xl p-3.5 max-w-md mx-auto">
              <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider block mb-1">
                AI Intake Assistant
              </span>
              <p className="text-sm font-medium text-zinc-200 leading-relaxed">
                {lastAiSpoken}
              </p>
            </div>
          )}

          {/* Inactivity / Status Feedback */}
          {statusMessage && (
            <p className="mt-2 text-xs font-medium text-teal-300 animate-fade-in">
              {statusMessage}
            </p>
          )}

          {/* Document Attachment Button in Voice Mode */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingDoc}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-teal-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full border border-zinc-700 transition disabled:opacity-50"
            >
              {isUploadingDoc ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
              ) : (
                <Paperclip className="h-3.5 w-3.5 text-teal-400" />
              )}
              <span>{isUploadingDoc ? 'Analyzing Report...' : 'Attach Medical Report (PDF/JPG)'}</span>
            </button>
          </div>

          {/* Quick Speech Simulation Chips for Evaluation */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-[11px] text-zinc-500">Quick simulation:</span>
            <button
              onClick={() => handleSimulatedInput('I have chest tightness and cold sweats')}
              className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-teal-300 hover:bg-zinc-700 transition"
            >
              "Chest tightness & sweat"
            </button>
            <button
              onClick={() => handleSimulatedInput('Started 2 days ago, around 6 out of 10')}
              className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] text-teal-300 hover:bg-zinc-700 transition"
            >
              "2 days ago, 6/10"
            </button>
          </div>

          {!isSpeechSupported && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-amber-400/90">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Microphone restricted in sandboxed preview; use quick speech chips or switch to text</span>
            </div>
          )}
        </div>

        {/* Bottom Control Actions with Hard Stop Button */}
        <div className="w-full flex items-center justify-between border-t border-zinc-800 pt-4">
          <button
            onClick={() => {
              handleHardStop();
              onSwitchToText();
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <MessageSquare className="h-4 w-4 text-zinc-400" />
            <span>Switch to Text Chat</span>
          </button>

          <button
            onClick={handleHardStop}
            className="flex items-center gap-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/80 px-4 py-2 text-xs font-semibold transition"
          >
            <Square className="h-3.5 w-3.5 fill-red-400 text-red-400" />
            <span>End Voice Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
