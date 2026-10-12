'use client';

// SPARSH VoiceVision — Floating Accessible Control Component
// Displays real-time assistant state, last recognized transcript, spoken response,
// polite ARIA live region for screen readers, and expandable TypedCommandInput.

import React, { useState } from 'react';
import { useVoiceAssistant, AssistantState } from './VoiceAssistantProvider';
import { TypedCommandInput } from './TypedCommandInput';
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  AlertCircle,
  Keyboard,
  ChevronDown,
  ChevronUp,
  X,
  VolumeX,
} from 'lucide-react';

export function VoiceAssistantControl() {
  const {
    state,
    transcript,
    lastResponse,
    errorMessage,
    toggleListening,
    stopAll,
    isSupported,
  } = useVoiceAssistant();

  const [expanded, setExpanded] = useState<boolean>(false);
  const [showTypedInput, setShowTypedInput] = useState<boolean>(false);

  const getStateColor = (s: AssistantState) => {
    switch (s) {
      case 'listening':
        return 'from-rose-500 to-pink-600 border-pink-300 text-white';
      case 'thinking':
        return 'from-indigo-600 to-[#6C63FF] border-indigo-300 text-white';
      case 'speaking':
        return 'from-[#00C9A7] to-emerald-600 border-emerald-300 text-white';
      case 'error':
        return 'from-red-600 to-rose-700 border-red-300 text-white';
      default:
        return 'from-[#6C63FF] to-[#00C9A7] border-white/20 text-white';
    }
  };

  const getStateLabel = (s: AssistantState) => {
    switch (s) {
      case 'listening':
        return 'Listening...';
      case 'thinking':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      case 'error':
        return 'Voice Error';
      default:
        return 'Voice Vision';
    }
  };

  return (
    <>
      {/* ── ARIA Live Polite Region (Ensures screen readers hear assistant feedback without shouting) ── */}
      <div
        id="voicevision-aria-live"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {state === 'listening' && 'SPARSH is listening for your command.'}
        {state === 'thinking' && 'Processing your request.'}
        {state === 'speaking' && lastResponse && `SPARSH says: ${lastResponse}`}
        {errorMessage && `Notice: ${errorMessage}`}
      </div>

      {/* ── Floating VoiceVision Widget ── */}
      <aside
        aria-label="SPARSH VoiceVision Assistant Control"
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex flex-col items-start gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md select-none"
      >
        {/* Status / Response Modal Card */}
        {(expanded || transcript || lastResponse || errorMessage || showTypedInput) && (
          <div className="glass-card w-80 sm:w-96 max-w-[calc(100vw-2rem)] p-4 rounded-2xl border-2 border-[#6C63FF]/60 bg-[#0f0c29]/95 text-white shadow-2xl backdrop-blur-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    state === 'listening'
                      ? 'bg-rose-400 animate-ping'
                      : state === 'speaking'
                      ? 'bg-[#00C9A7] animate-pulse'
                      : state === 'thinking'
                      ? 'bg-indigo-400 animate-spin'
                      : 'bg-white/40'
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#00C9A7]">
                  SPARSH VoiceVision
                </span>
                <span className="text-[10px] text-white/40 font-mono">(Alt+V)</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowTypedInput(!showTypedInput)}
                  className={`p-1 rounded-md transition ${
                    showTypedInput
                      ? 'bg-[#6C63FF] text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                  title="Toggle keyboard command input"
                  aria-label="Toggle keyboard command input"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setShowTypedInput(false);
                  }}
                  className="p-1 text-white/50 hover:text-white rounded-md hover:bg-white/10 transition"
                  aria-label="Close assistant card"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Heard Transcript */}
            {transcript && (
              <div className="space-y-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                  You Said:
                </p>
                <p className="text-xs sm:text-sm text-white font-medium bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                  "{transcript}"
                </p>
              </div>
            )}

            {/* Spoken Response */}
            {lastResponse && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#00C9A7] uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> SPARSH:
                  </p>
                  {state === 'speaking' && (
                    <button
                      onClick={stopAll}
                      className="text-[10px] text-rose-300 hover:text-rose-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20"
                    >
                      <VolumeX className="w-2.5 h-2.5" /> Mute
                    </button>
                  )}
                </div>
                <p className="text-xs text-white/90 leading-relaxed bg-[#6C63FF]/10 p-2.5 rounded-xl border border-[#6C63FF]/20 max-h-36 overflow-y-auto">
                  {lastResponse}
                </p>
              </div>
            )}

            {/* Typed Command Input */}
            {showTypedInput && (
              <div className="pt-1 border-t border-white/10">
                <TypedCommandInput showShortcuts={true} />
              </div>
            )}
          </div>
        )}

        {/* ── Main High-Contrast Trigger Buttons ── */}
        <div className="flex items-center gap-2">
          <button
            id="voicevision-mic-toggle"
            onClick={toggleListening}
            aria-label={
              state === 'listening'
                ? 'Stop voice listening'
                : 'Start voice listening. Shortcut Alt plus V'
            }
            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-black transition-all border-2 bg-gradient-to-r transform hover:scale-105 active:scale-95 cursor-pointer ${getStateColor(
              state
            )}`}
          >
            {state === 'thinking' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : state === 'listening' ? (
              <>
                <Mic className="w-4 h-4 animate-bounce text-white" />
                <span>Listening...</span>
              </>
            ) : state === 'speaking' ? (
              <>
                <Volume2 className="w-4 h-4 animate-pulse text-white" />
                <span>Speaking...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>VoiceVision</span>
              </>
            )}
          </button>

          {/* Expand / Keyboard Input Quick Toggle Button */}
          <button
            id="voicevision-keyboard-toggle"
            type="button"
            onClick={() => {
              setShowTypedInput(!showTypedInput);
              setExpanded(true);
            }}
            aria-label="Open typed command terminal"
            title="Type command (Alt+T)"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#0f0c29]/90 hover:bg-white/10 border-2 border-white/20 flex items-center justify-center text-white/80 hover:text-white transition shadow-xl cursor-pointer"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
