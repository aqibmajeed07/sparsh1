/**
 * SPARSH — Gemini Lady Voice Synthesizer
 *
 * Provides a smooth, ultra-clear, natural "Gemini Lady" voice for all AI speech across the platform.
 * Eliminates robotic clicking, weird digital noise, and garbled symbols by:
 * 1. Selecting the best high-definition Google / Microsoft Natural female voice.
 * 2. Stripping raw markdown (*, #, _, -, bullets, ISL glosses) before vocalizing.
 * 3. Chunking long responses into clean sentences to bypass browser audio buffer underruns.
 * 4. Preserving 100% local Ollama AI intelligence for generation.
 */

export interface GeminiVoiceOptions {
  pitch?: number;
  rate?: number;
  volume?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onSentence?: (sentence: string) => void;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;
let isSpeakingGlobal = false;
let stopRequested = false;

/**
 * Cleans markdown, formatting artifacts, and special characters from AI output
 * so speech synthesis speaks clean, natural human sentences.
 */
export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText
    // Remove ISL GLOSS lines or code blocks
    .replace(/^ISL\s*GLOSS:.*$/gim, '')
    .replace(/^ISL:.*$/gim, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove Markdown headers and bold/italic markers
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove Markdown bullets and blockquotes
    .replace(/^[\s*-•+>]+\s+/gm, '')
    // Remove Markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Replace technical symbols with spoken words
    .replace(/&/g, ' and ')
    .replace(/%/g, ' percent ')
    .replace(/°C/g, ' degrees Celsius ')
    .replace(/°F/g, ' degrees Fahrenheit ')
    .replace(/->|→/g, ' leads to ')
    .replace(/=>|⇒/g, ' results in ')
    .replace(/<=|≤/g, ' less than or equal to ')
    .replace(/>=|≥/g, ' greater than or equal to ')
    .replace(/!=|≠/g, ' not equal to ')
    .replace(/\//g, ' or ')
    // Remove emojis that cause speech synth glitches
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Normalize excess whitespace and linebreaks
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Finds the highest quality "Gemini Lady" (warm, clear, natural female) voice available in the browser.
 */
export function getGeminiLadyVoice(lang: string = 'en-US'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Filter voices that match language family if specified
  const targetLang = lang.split('-')[0].toLowerCase();

  // Tier 1: Premium Google / Gemini Natural Female voices
  const googleLady = voices.find(v =>
    (v.name.includes('Google') || v.name.includes('Natural')) &&
    (v.name.toLowerCase().includes('female') || v.name.includes('UK English Female') || v.name.includes('US English')) &&
    !v.name.toLowerCase().includes('male')
  );
  if (googleLady) return googleLady;

  // Tier 2: Microsoft Natural Neural Female voices (Edge/Windows)
  const msNaturalLady = voices.find(v =>
    (v.name.includes('Natural') || v.name.includes('Online')) &&
    (v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Neerja') || v.name.includes('Sonia') || v.name.includes('Zira'))
  );
  if (msNaturalLady) return msNaturalLady;

  // Tier 3: Any Apple or OS female voice (Samantha, Victoria, Karen, Zira)
  const osLady = voices.find(v =>
    (v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Zira') || v.name.includes('Karen')) &&
    !v.name.toLowerCase().includes('male')
  );
  if (osLady) return osLady;

  // Tier 4: Language-matched female voice
  const langLady = voices.find(v =>
    v.lang.toLowerCase().startsWith(targetLang) &&
    (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.toLowerCase().includes('girl'))
  );
  if (langLady) return langLady;

  // Tier 5: Best Google voice matching language
  const googleAny = voices.find(v => v.name.includes('Google') && v.lang.toLowerCase().startsWith(targetLang));
  if (googleAny) return googleAny;

  // Tier 6: Default English voice
  return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
}

/**
 * Splits text into individual clean sentences so long responses never timeout or distort.
 */
function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  if (!matches) return [text];
  return matches.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Speaks text using the smooth Gemini Lady voice with sentence chaining.
 */
export function speakGeminiLady(text: string, options: GeminiVoiceOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onEnd?.();
      resolve();
      return;
    }

    // Stop any existing utterance cleanly
    stopGeminiLady();
    stopRequested = false;

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) {
      options.onEnd?.();
      resolve();
      return;
    }

    const sentences = splitIntoSentences(cleaned);
    let index = 0;
    isSpeakingGlobal = true;
    options.onStart?.();

    const voice = getGeminiLadyVoice(options.lang || 'en-US');

    function speakNext() {
      if (stopRequested || index >= sentences.length) {
        isSpeakingGlobal = false;
        activeUtterance = null;
        options.onEnd?.();
        resolve();
        return;
      }

      const sentenceText = sentences[index];
      options.onSentence?.(sentenceText);

      const utterance = new SpeechSynthesisUtterance(sentenceText);
      utterance.voice = voice;
      utterance.lang = options.lang || 'en-US';

      // Warm, natural, expressive Gemini settings:
      // Pitch: 1.08 (feminine, warm, clear, non-robotic)
      // Rate: 1.02 (fluid, natural conversational pace)
      utterance.pitch = options.pitch ?? 1.08;
      utterance.rate = options.rate ?? 1.02;
      utterance.volume = options.volume ?? 1.0;

      utterance.onend = () => {
        if (stopRequested) {
          isSpeakingGlobal = false;
          options.onEnd?.();
          resolve();
          return;
        }
        index++;
        // Natural micro-pause between sentences (70ms)
        setTimeout(speakNext, 70);
      };

      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') {
          isSpeakingGlobal = false;
          options.onEnd?.();
          resolve();
          return;
        }
        console.warn('[Gemini Voice] Utterance warning:', e.error);
        index++;
        speakNext();
      };

      activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    }

    // Ensure voices are loaded (Chrome async quirk)
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        utteranceVoiceReload();
        speakNext();
      };
    } else {
      speakNext();
    }

    function utteranceVoiceReload() {
      if (voice === null) {
        const reloaded = getGeminiLadyVoice(options.lang || 'en-US');
        if (reloaded && activeUtterance) {
          activeUtterance.voice = reloaded;
        }
      }
    }
  });
}

/**
 * Immediately cancels speaking without distortion or residual queuing.
 */
export function stopGeminiLady() {
  stopRequested = true;
  isSpeakingGlobal = false;
  activeUtterance = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
  }
}

/**
 * Returns whether speech is currently in progress.
 */
export function isGeminiSpeaking(): boolean {
  return isSpeakingGlobal;
}
