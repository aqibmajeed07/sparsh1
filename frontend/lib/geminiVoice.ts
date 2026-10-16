/**
 * SPARSH — Gemini Lady Voice Synthesizer
 *
 * Provides a smooth, ultra-clear, natural "Gemini Lady" voice for all AI speech across the platform.
 * Reads the FULL content on display from beginning to end without stopping after a few words.
 *
 * Resilient Architecture for Browser Speech Quirks:
 * 1. Chrome GC Bug: Pinned globally to window root so V8 garbage collector cannot abort playback.
 * 2. Windows Audio Driver Collision: 80ms WASAPI settling buffer between utterances.
 * 3. Driver 'interrupted' Recovery: Distinguishes between user cancellations and driver hiccups;
 *    automatically proceeds to next sentence instead of dying after 3-4 words.
 * 4. Micro-Chunk Prevention: Sentence splitter merges short fragments (< 35 chars) so numbered
 *    bullets, abbreviations, and short clauses never create 1-word or 2-word audio dropouts.
 * 5. Chrome 15-Second Cutoff: Built-in 8s pause/resume heartbeat ensures long texts never freeze.
 * 6. High-Definition Lady Voice: Prioritizes Google UK/US Female and Microsoft Natural Neural female voices.
 */

export interface GeminiVoiceOptions {
  pitch?: number;
  rate?: number;
  volume?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onSentence?: (sentence: string, index: number, total: number) => void;
}

let isSpeakingGlobal = false;
let userStopRequested = false;
let heartbeatTimer: any = null;
let currentSessionId = 0;

/**
 * Cleans markdown, formatting artifacts, and technical symbols so the synthesizer
 * speaks every single word and concept clearly without skipping or cutting off.
 */
export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove ISL GLOSS lines or labeling artifacts
    .replace(/^ISL\s*GLOSS:.*$/gim, '')
    .replace(/^ISL:.*$/gim, '')
    .replace(/^Line\s*\d+:?\s*/gim, '')
    .replace(/^Section\s*\d+:?\s*/gim, '')
    // Remove Markdown headers (# Header)
    .replace(/^#+\s+/gm, '')
    // Remove Bold and Italic markers (**bold** -> bold)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Convert numbered lists cleanly: "1. " -> "Point 1: " so decimal points don't break speech
    .replace(/^\s*(\d+)\.\s+/gm, 'Point $1: ')
    // Remove bullet points (- or *)
    .replace(/^[\s*-•+>]+\s+/gm, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Convert technical symbols into clear spoken words
    .replace(/&/g, ' and ')
    .replace(/%/g, ' percent ')
    .replace(/°C/g, ' degrees Celsius ')
    .replace(/°F/g, ' degrees Fahrenheit ')
    .replace(/->|→/g, ' leads to ')
    .replace(/=>|⇒/g, ' results in ')
    .replace(/<=|≤/g, ' less than or equal to ')
    .replace(/>=|≥/g, ' greater than or equal to ')
    .replace(/!=|≠/g, ' not equal to ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equals ')
    .replace(/\//g, ' or ')
    // Remove emojis that cause browser TTS to stumble
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Clean up multiple line breaks into natural breathing pauses
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Splits text into robust, natural sentence chunks.
 * Merges short fragments (< 35 chars) so we NEVER produce micro-chunks of 1-3 words.
 * Never splits on decimal numbers (e.g. 3.14), numbered lists ("Point 1: "), or common abbreviations.
 */
export function splitIntoCleanSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Protect common abbreviations and decimals by temporarily masking them
  const protectedText = text
    .replace(/(\b\d+)\.(\d+\b)/g, '$1_DOT_$2')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof|vs|etc|approx|eg|ie)\./gi, '$1_DOT_')
    .replace(/\b(e\.g|i\.e)\./gi, '$1_DOT_');

  // Split on natural sentence ends (. ! ? or semicolon followed by space or newline)
  const rawParts = protectedText.split(/(?<=[.!?])\s+|\n+/);
  const chunks: string[] = [];
  let buffer = '';

  for (const raw of rawParts) {
    const part = raw.replace(/_DOT_/g, '.').trim();
    if (!part) continue;

    // If buffer is too short, merge with current part (avoids tiny 2-3 word utterances)
    if (buffer && (buffer.length < 45 || buffer.split(/\s+/).length < 7)) {
      buffer = buffer + ' ' + part;
    } else {
      if (buffer) chunks.push(buffer);
      buffer = part;
    }

    // If a single combined chunk is exceptionally long (> 220 chars), divide along commas
    if (buffer.length > 220) {
      const subClauses = buffer.split(/(?<=[,;])\s+/);
      if (subClauses.length > 1) {
        let subBuf = '';
        for (const cl of subClauses) {
          if ((subBuf + ' ' + cl).trim().length <= 160) {
            subBuf = (subBuf + ' ' + cl).trim();
          } else {
            if (subBuf) chunks.push(subBuf);
            subBuf = cl.trim();
          }
        }
        buffer = subBuf;
      }
    }
  }

  if (buffer) chunks.push(buffer);

  return chunks.length > 0 ? chunks : [text.trim()];
}

/**
 * Finds the highest quality "Gemini Lady" (warm, clear, natural female) voice available in the browser.
 */
export function getGeminiLadyVoice(lang: string = 'en-US'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const targetLang = (lang || 'en-US').split('-')[0].toLowerCase();

  // Tier 1: Premium Google / Gemini Natural Female voices (Chrome)
  const googleLady = voices.find(v =>
    (v.name.includes('Google') || v.name.includes('Natural')) &&
    (v.name.includes('UK English Female') || v.name.includes('US English') || v.name.toLowerCase().includes('female')) &&
    !v.name.toLowerCase().includes('male')
  );
  if (googleLady) return googleLady;

  // Tier 2: Microsoft Natural Neural Female voices (Edge / Windows 10/11)
  const msNaturalLady = voices.find(v =>
    (v.name.includes('Natural') || v.name.includes('Online')) &&
    (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Neerja') || v.name.includes('Sonia') || v.name.includes('Zira'))
  );
  if (msNaturalLady) return msNaturalLady;

  // Tier 3: Apple / OS High Quality Female voices
  const osLady = voices.find(v =>
    (v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Zira') || v.name.includes('Karen')) &&
    !v.name.toLowerCase().includes('male')
  );
  if (osLady) return osLady;

  // Tier 4: Language-matched female voice
  const langLady = voices.find(v =>
    v.lang.toLowerCase().startsWith(targetLang) &&
    (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman'))
  );
  if (langLady) return langLady;

  // Tier 5: Best Google voice matching target language
  const googleAny = voices.find(v => v.name.includes('Google') && v.lang.toLowerCase().startsWith(targetLang));
  if (googleAny) return googleAny;

  // Tier 6: Default English voice
  return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
}

/**
 * Speaks the FULL text smoothly using the Gemini Lady voice with resilient sentence chaining.
 * Guaranteed to read ALL paragraphs from start to finish without stopping after 3-4 words.
 */
export function speakGeminiLady(text: string, options: GeminiVoiceOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onEnd?.();
      resolve();
      return;
    }

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) {
      options.onEnd?.();
      resolve();
      return;
    }

    // Cleanly cancel previous speech and increment session id to invalidate older runs
    stopGeminiLady();
    userStopRequested = false;
    isSpeakingGlobal = true;
    const thisSessionId = ++currentSessionId;

    const sentences = splitIntoCleanSentences(cleaned);
    let currentIndex = 0;

    // Global GC protection array
    if (typeof window !== 'undefined') {
      (window as any).__sparsh_speech_pool = (window as any).__sparsh_speech_pool || [];
    }

    // Windows Audio Driver Settling Buffer (80ms)
    // Ensures previous audio handles are released before queueing new speech
    setTimeout(() => {
      if (userStopRequested || thisSessionId !== currentSessionId) {
        isSpeakingGlobal = false;
        resolve();
        return;
      }

      options.onStart?.();

      // Clear existing heartbeat
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      // Keepalive heartbeat: prevents Chrome from sleeping or pausing long speech runs
      heartbeatTimer = setInterval(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else if (!isSpeakingGlobal) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
      }, 8000);

      function speakNextChunk() {
        if (userStopRequested || thisSessionId !== currentSessionId) {
          cleanup();
          resolve();
          return;
        }

        if (currentIndex >= sentences.length) {
          cleanup();
          options.onEnd?.();
          resolve();
          return;
        }

        const chunkText = sentences[currentIndex];
        options.onSentence?.(chunkText, currentIndex, sentences.length);

        try {
          const utterance = new SpeechSynthesisUtterance(chunkText);

          // PIN TO GLOBAL WINDOW: Prevents Chrome's V8 Garbage Collector from killing speech midway!
          if (typeof window !== 'undefined') {
            (window as any).__sparsh_active_utterance = utterance;
            (window as any).__sparsh_speech_pool.push(utterance);
            // Cap pool size to prevent memory bloat
            if ((window as any).__sparsh_speech_pool.length > 50) {
              (window as any).__sparsh_speech_pool.shift();
            }
          }

          const voice = getGeminiLadyVoice(options.lang || 'en-US');
          if (voice) {
            utterance.voice = voice;
          }
          utterance.lang = options.lang || 'en-US';

          // Natural, warm, expressive Gemini Lady settings
          utterance.pitch = options.pitch ?? 1.06;
          utterance.rate = options.rate ?? 1.0;
          utterance.volume = options.volume ?? 1.0;

          utterance.onend = () => {
            if (userStopRequested || thisSessionId !== currentSessionId) {
              cleanup();
              resolve();
              return;
            }

            currentIndex++;
            // Natural 80ms breathing pause between sentences; gives Windows WASAPI time to cycle
            setTimeout(speakNextChunk, 80);
          };

          utterance.onerror = (e) => {
            if (userStopRequested || thisSessionId !== currentSessionId) {
              cleanup();
              resolve();
              return;
            }

            // CRITICAL FIX: If Windows audio driver throws 'interrupted' or 'canceled',
            // DO NOT ABORT! It is a driver audio session reset. Smoothly advance to the next sentence!
            console.warn('[Gemini Voice] Utterance driver notification:', e.error, '- advancing to next sentence');
            currentIndex++;
            setTimeout(speakNextChunk, 100);
          };

          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('[Gemini Voice] Synthesis error, advancing:', err);
          currentIndex++;
          setTimeout(speakNextChunk, 100);
        }
      }

      function cleanup() {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (typeof window !== 'undefined') {
          (window as any).__sparsh_active_utterance = null;
        }
        isSpeakingGlobal = false;
      }

      // If voices are not yet loaded in Chrome, wait for them
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          speakNextChunk();
        };
      } else {
        speakNextChunk();
      }
    }, 80);
  });
}

/**
 * Immediately cancels speaking cleanly without residual queuing.
 */
export function stopGeminiLady() {
  userStopRequested = true;
  isSpeakingGlobal = false;
  currentSessionId++;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (typeof window !== 'undefined') {
    (window as any).__sparsh_active_utterance = null;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }
}

/**
 * Returns whether speech is currently in progress.
 */
export function isGeminiSpeaking(): boolean {
  return isSpeakingGlobal;
}
