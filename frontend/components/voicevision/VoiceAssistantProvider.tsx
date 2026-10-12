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
  toggleListening: () => void;
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
  const [isSupported, setIsSupported] = useState<boolean>(true);

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
        setState('idle');
        if (onDone) onDone();

        // Resume listening if continuous listening was active
        if (recognizerRef.current) {
          recognizerRef.current.resumeAfterTTS();
        }
      },
      onError: () => {
        isSpeakingRef.current = false;
        setState('idle');
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
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
        try {
          const res = await fetch(`${backendUrl}/api/ai-tutor/chat`, {
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

  // ── Toggle Listening Action ─────────────────────────────────────────────────
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
        // Check for wake phrase if listening mode is on
        if (activationManagerRef.current) {
          const wakeCheck = activationManagerRef.current.checkWakePhrase(heardText);
          if (wakeCheck.matched && wakeCheck.stripped) {
            executeCommand(wakeCheck.stripped);
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
          setState('idle');
        }
      },
    });

    recognizerRef.current = recognizer;

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

    // 3. Smart Glasses Physical Button Poller
    let lastButtonId = 0;
    const glassesButtonInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/glasses/button-result?since=${lastButtonId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.id === 'number' && data.id > lastButtonId) {
            lastButtonId = data.id;
            if (data.text && data.text.trim()) {
              speak(data.text);
            }
          }
        }
      } catch {
        // Silently ignore if offline
      }
    }, 1500);

    return () => {
      clearInterval(glassesButtonInterval);
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
        toggleListening,
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
