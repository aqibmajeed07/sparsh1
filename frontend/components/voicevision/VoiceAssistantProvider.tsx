'use client';

// SPARSH VoiceVision — Context Provider
// Central state machine for speech recognition, sentence-chunked TTS,
// turn-taking guardrails (barge-in and self-hearing prevention), and command dispatch.

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SpeechRecognizer } from '@/lib/voicevision/speech/recognizer';
import { SentenceChunkedTTS } from '@/lib/voicevision/speech/tts';
import { ActivationManager } from '@/lib/voicevision/speech/activation';
import { globalCommandRegistry } from '@/lib/voicevision/commands/registry';
import { CommandContext } from '@/lib/voicevision/commands/types';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceAssistantContextType {
  state: AssistantState;
  transcript: string;
  lastResponse: string | null;
  errorMessage: string | null;
  lastCapturedImage: string | null;
  setLastCapturedImage: (url: string | null) => void;
  refreshCameraPreview: () => Promise<void>;
  toggleListening: () => void;
  isAlwaysListening: boolean;
  toggleAlwaysListening: (forceState?: boolean) => void;
  executeCommand: (rawInput: string) => Promise<void>;
  speak: (text: string, onDone?: () => void) => void;
  stopAll: () => void;
  tts: SentenceChunkedTTS;
  isSupported: boolean;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | null>(null);

export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<AssistantState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isAlwaysListening, setIsAlwaysListening] = useState<boolean>(false);

  // Core engines
  const ttsRef = useRef<SentenceChunkedTTS>(
    new SentenceChunkedTTS({
      lang: 'en-IN',
      rate: 1.0,
      pitch: 1.0,
    })
  );

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const activationManagerRef = useRef<ActivationManager | null>(null);

  // State refs to prevent race conditions during turn-taking
  const isSpeakingRef = useRef<boolean>(false);
  const isExecutingRef = useRef<boolean>(false);
  const isAlwaysListeningRef = useRef<boolean>(false);

  useEffect(() => {
    isAlwaysListeningRef.current = isAlwaysListening;
  }, [isAlwaysListening]);

  // Load persisted Always-On setting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sparsh_always_listen');
      // Default to true for smart glasses users or if saved
      if (saved === 'true') {
        setIsAlwaysListening(true);
      }
    }
  }, []);

  // ── Unified Speak Helper with turn-taking ───────────────────────────────────
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!text || !text.trim()) {
      if (onDone) onDone();
      return;
    }

    setLastResponse(text);
    setState('speaking');
    isSpeakingRef.current = true;

    // Turn-taking rule: Pause recognition while TTS speaks to prevent hearing itself
    if (recognizerRef.current) {
      recognizerRef.current.pauseForTTS();
    }

    ttsRef.current.speak(text, {
      onEnd: () => {
        isSpeakingRef.current = false;
        setState(isAlwaysListeningRef.current ? 'listening' : 'idle');
        if (onDone) onDone();

        // Resume listening immediately
        if (recognizerRef.current) {
          recognizerRef.current.resumeAfterTTS();
        }
      },
      onError: () => {
        isSpeakingRef.current = false;
        setState(isAlwaysListeningRef.current ? 'listening' : 'idle');
        if (onDone) onDone();

        if (recognizerRef.current) {
          recognizerRef.current.resumeAfterTTS();
        }
      },
    });
  }, []);

  // ── Stop All (Barge-in rule) ────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    ttsRef.current.stop();
    isSpeakingRef.current = false;
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }
    if (activationManagerRef.current) {
      activationManagerRef.current.releaseWakeLock();
    }
    setState('idle');
  }, []);

  // ── Execute Command Pipeline (feeds both voice and typed input) ────────────
  const executeCommand = useCallback(
    async (rawInput: string) => {
      const trimmed = (rawInput || '').trim();
      if (!trimmed) return;

      setTranscript(trimmed);
      setErrorMessage(null);

      // Barge-in rule: Stop any ongoing TTS when a new command is received
      if (isSpeakingRef.current) {
        ttsRef.current.stop();
        isSpeakingRef.current = false;
      }

      setState('thinking');
      isExecutingRef.current = true;

      // Construct execution context
      const commandContext: CommandContext = {
        transcript: trimmed,
        rawTranscript: rawInput,
        params: {},
        pathname: pathname || '/student',
        speak,
        navigate: (path: string) => router.push(path),
        confirm: (promptText: string) =>
          globalCommandRegistry.confirmationManager.requestConfirmation(promptText, speak),
        tts: ttsRef.current,
        setCapturedImage: (imgUrl: string) => setLastCapturedImage(imgUrl),
      };

      try {
        const dispatchOutcome = await globalCommandRegistry.dispatch(trimmed, commandContext);

        if (dispatchOutcome.handled) {
          isExecutingRef.current = false;
          // If the command didn't initiate speech, return state to idle
          if (!isSpeakingRef.current) {
            setState('idle');
          }
          return;
        }

        // Fallback: If no recognized navigation/command intent, query SPARSH AI Tutor
        try {
          const res = await fetch('/api/ai-tutor/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed, language: 'en-US', detailed: false }),
          });

          if (res.ok) {
            const data = await res.json();
            const reply = data.reply || 'I am here to help you learn on SPARSH.';
            speak(reply);
          } else {
            throw new Error('AI query failed');
          }
        } catch {
          speak(`I heard "${trimmed}". Try saying open dashboard, open lessons, or what can I do here.`);
        }
      } catch (err: any) {
        console.error('[VoiceAssistantProvider] Command processing error:', err);
        setErrorMessage(err?.message || 'Error running command');
        speak('Sorry, I encountered an error processing that.');
      } finally {
        isExecutingRef.current = false;
        if (!isSpeakingRef.current) {
          setState('idle');
        }
      }
    },
    [pathname, router, speak]
  );

  const refreshCameraPreview = useCallback(async () => {
    setState('thinking');
    speak('Refreshing smart glasses view.');
    try {
      const { fetchGlassesApi } = await import('@/lib/voicevision/glassesApi');
      const res = await fetchGlassesApi('vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Describe what is in front of me clearly and concisely for an inclusive learner.' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image_url) {
          setLastCapturedImage(data.image_url);
        }
        if (data.description) {
          speak(data.description);
        }
      } else {
        speak('Glasses camera is not reachable.');
      }
    } catch {
      speak('Could not connect to glasses camera.');
    } finally {
      setState('idle');
    }
  }, [speak]);

  // ── Toggle Always-On Audio Listening Action ─────────────────────────────
  const toggleAlwaysListening = useCallback((forceState?: boolean) => {
    if (!SpeechRecognizer.isSupported()) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setIsAlwaysListening((prev) => {
      const nextVal = typeof forceState === 'boolean' ? forceState : !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sparsh_always_listen', String(nextVal));
      }

      if (nextVal) {
        if (activationManagerRef.current) {
          activationManagerRef.current.requestWakeLock();
        }
        recognizerRef.current?.start(true);
        setState('listening');
        speak('Always-on voice is active. Say "take image" or "analyse in front of me" anytime.');
      } else {
        recognizerRef.current?.stop();
        setState('idle');
        speak('Always-on voice is paused.');
      }
      return nextVal;
    });
  }, [speak]);

  // ── Toggle Listening Action (Single / Push-to-Talk) ─────────────────────────
  const toggleListening = useCallback(() => {
    if (!SpeechRecognizer.isSupported()) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (state === 'listening') {
      stopAll();
      speak('Voice listening paused.');
    } else {
      // Barge-in: stop active speech immediately
      if (isSpeakingRef.current) {
        ttsRef.current.stop();
        isSpeakingRef.current = false;
      }

      if (activationManagerRef.current) {
        activationManagerRef.current.requestWakeLock();
      }

      if (recognizerRef.current) {
        const started = recognizerRef.current.start(true); // continuous listening mode
        if (started) {
          setState('listening');
        }
      }
    }
  }, [state, stopAll, speak]);

  // ── Initialization Lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    setIsSupported(SpeechRecognizer.isSupported());

    // 1. Initialize Recognizer
    const recognizer = new SpeechRecognizer('en-IN', {
      onStart: () => setState('listening'),
      onResult: (heardText) => {
        // Check for wake phrase
        if (activationManagerRef.current) {
          const wakeCheck = activationManagerRef.current.checkWakePhrase(heardText);
          if (wakeCheck.matched) {
            if (wakeCheck.stripped && wakeCheck.stripped.length > 0) {
              executeCommand(wakeCheck.stripped);
            } else {
              // User literally said "hello sparsh" -> immediately activate smart glasses camera!
              executeCommand('describe what is in front of me');
            }
            return;
          }
        }
        executeCommand(heardText);
      },
      onError: (errType, msg) => {
        if (errType !== 'no-speech') {
          setErrorMessage(msg);
          setState('error');
        }
      },
      onEnd: () => {
        if (!isSpeakingRef.current && !isExecutingRef.current) {
          setState(isAlwaysListeningRef.current ? 'listening' : 'idle');
        }
      },
    });

    recognizerRef.current = recognizer;

    // Auto-start continuous listening if Always-On mode is configured or saved
    if (typeof window !== 'undefined' && localStorage.getItem('sparsh_always_listen') === 'true') {
      setTimeout(() => {
        activationManagerRef.current?.requestWakeLock();
        recognizer.start(true);
        setState('listening');
      }, 600);
    }

    // 2. Initialize Activation Manager
    const activation = new ActivationManager({
      onActivate: (trigger) => {
        if (trigger === 'hotkey' || trigger === 'button' || trigger === 'glasses-button') {
          toggleListening();
        }
      },
    });
    activation.init();
    activationManagerRef.current = activation;

    return () => {
      activation.destroy();
      recognizer.stop();
      ttsRef.current.stop();
    };
  }, [executeCommand, toggleListening, speak]);

  return (
    <VoiceAssistantContext.Provider
      value={{
        state,
        transcript,
        lastResponse,
        errorMessage,
        lastCapturedImage,
        setLastCapturedImage,
        refreshCameraPreview,
        toggleListening,
        isAlwaysListening,
        toggleAlwaysListening,
        executeCommand,
        speak,
        stopAll,
        tts: ttsRef.current,
        isSupported,
      }}
    >
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
  }
  return context;
}
