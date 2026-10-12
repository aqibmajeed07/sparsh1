'use client';

// SPARSH VoiceVision — Typed Command Input Component
// Feeds the EXACT same command pipeline as speech recognition.
// Essential for automated browser agents and students with speech/vocal disabilities.

import React, { useState } from 'react';
import { useVoiceAssistant } from './VoiceAssistantProvider';
import { Send, Terminal, Sparkles } from 'lucide-react';

interface TypedCommandInputProps {
  placeholder?: string;
  className?: string;
  showShortcuts?: boolean;
}

export function TypedCommandInput({
  placeholder = 'Type a voice command (e.g. "open lessons", "read this lesson")...',
  className = '',
  showShortcuts = true,
}: TypedCommandInputProps) {
  const { executeCommand, state } = useVoiceAssistant();
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;
    setInputVal('');
    await executeCommand(cmd);
  };

  const handleChipClick = async (phrase: string) => {
    await executeCommand(phrase);
  };

  const SAMPLE_SHORTCUTS = [
    'open my dashboard',
    'show my online classes',
    'open lessons',
    'read this lesson',
    'what can i do here',
    'help',
  ];

  return (
    <div className={`w-full max-w-xl mx-auto space-y-2 ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-white/50 pointer-events-none">
          <Terminal className="w-4 h-4 text-[#00C9A7]" />
        </div>
        <input
          id="typed-voice-command-input"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={placeholder}
          aria-label="Type a command to control SPARSH by text"
          disabled={state === 'thinking'}
          className="w-full pl-10 pr-24 py-2.5 rounded-xl bg-black/60 border border-white/20 text-white placeholder-white/40 text-xs sm:text-sm focus:outline-none focus:border-[#00C9A7] focus:ring-1 focus:ring-[#00C9A7] transition backdrop-blur-md"
        />
        <button
          id="typed-voice-command-submit"
          type="submit"
          disabled={!inputVal.trim() || state === 'thinking'}
          className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <span>Send</span>
          <Send className="w-3 h-3" />
        </button>
      </form>

      {showShortcuts && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-[#00C9A7]" /> Shortcuts:
          </span>
          {SAMPLE_SHORTCUTS.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => handleChipClick(phrase)}
              className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition cursor-pointer"
            >
              "{phrase}"
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
