// SPARSH VoiceVision — Sentence-Chunked Text-to-Speech Engine
// Implements resilient sentence chunking and cancel-and-remember pause/resume
// to overcome native SpeechSynthesis limitations on Android Chrome and desktop browsers.

import { getGeminiLadyVoice } from '@/lib/geminiVoice';

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  onChunkChange?: (index: number, total: number, chunk: string) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export class SentenceChunkedTTS {
  private chunks: string[] = [];
  private currentIndex: number = 0;
  private isSpeaking: boolean = false;
  private isPaused: boolean = false;
  private options: TTSOptions;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(options: TTSOptions = {}) {
    this.options = {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      lang: 'en-IN',
      ...options,
    };
  }

  public updateOptions(newOptions: Partial<TTSOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Splits long prose into natural sentence chunks of < 180 characters.
   */
  public static splitIntoSentences(text: string): string[] {
    if (!text || !text.trim()) return [];

    // Normalize whitespace and linebreaks
    const cleaned = text.replace(/[\r\n]+/g, '. ').replace(/\s+/g, ' ').trim();

    // Split on punctuation (. ? ! ;) followed by space or end
    const rawSentences = cleaned.split(/(?<=[.?!;:])\s+/);
    const chunks: string[] = [];

    for (const raw of rawSentences) {
      const sentence = raw.trim();
      if (!sentence) continue;

      if (sentence.length <= 180) {
        chunks.push(sentence);
      } else {
        // Sub-chunk by commas or conjunctions if a single sentence is unusually long
        const clauses = sentence.split(/(?<=[,])\s+/);
        let buffer = '';
        for (const cl of clauses) {
          if ((buffer + ' ' + cl).trim().length <= 180) {
            buffer = (buffer + ' ' + cl).trim();
          } else {
            if (buffer) chunks.push(buffer);
            buffer = cl.trim();
          }
        }
        if (buffer) chunks.push(buffer);
      }
    }

    return chunks.length > 0 ? chunks : [cleaned];
  }

  /**
   * Speak a text string by breaking it into sentence chunks.
   */
  public speak(text: string, options?: Partial<TTSOptions>) {
    this.stop();
    if (options) {
      this.updateOptions(options);
    }

    this.chunks = SentenceChunkedTTS.splitIntoSentences(text);
    this.currentIndex = 0;
    this.isPaused = false;

    if (this.chunks.length === 0) {
      this.options.onEnd?.();
      return;
    }

    this.isSpeaking = true;
    this.speakCurrentChunk();
  }

  /**
   * Resilient Pause: Cancels native speech synthesis immediately and preserves
   * current chunk index, because native pause() is unreliable on Android Chrome.
   */
  public pause() {
    if (!this.isSpeaking || this.isPaused) return;

    this.isPaused = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Resume speech playback from the exact chunk index where paused.
   */
  public resume() {
    if (!this.isPaused || this.chunks.length === 0) return;

    this.isPaused = false;
    this.isSpeaking = true;
    this.speakCurrentChunk();
  }

  /**
   * Stop all speech synthesis and reset chunk pointers.
   */
  public stop() {
    this.isSpeaking = false;
    this.isPaused = false;
    this.chunks = [];
    this.currentIndex = 0;
    this.currentUtterance = null;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Repeat the current or most recent sentence chunk.
   */
  public repeat() {
    if (this.chunks.length === 0) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isPaused = false;
    this.isSpeaking = true;
    this.speakCurrentChunk();
  }

  /**
   * Jump forward to the next sentence chunk.
   */
  public next() {
    if (this.currentIndex < this.chunks.length - 1) {
      this.currentIndex++;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.isPaused = false;
      this.isSpeaking = true;
      this.speakCurrentChunk();
    } else {
      this.stop();
      this.options.onEnd?.();
    }
  }

  /**
   * Step backward to the previous sentence chunk.
   */
  public previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.isPaused = false;
      this.isSpeaking = true;
      this.speakCurrentChunk();
    }
  }

  public getStatus() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      totalChunks: this.chunks.length,
      currentText: this.chunks[this.currentIndex] || '',
    };
  }

  private speakCurrentChunk() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isSpeaking = false;
      this.options.onError?.(new Error('SpeechSynthesis not supported'));
      return;
    }

    if (this.currentIndex >= this.chunks.length) {
      this.isSpeaking = false;
      this.options.onEnd?.();
      return;
    }

    const chunkText = this.chunks[this.currentIndex];
    this.options.onChunkChange?.(this.currentIndex, this.chunks.length, chunkText);

    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.lang = this.options.lang || 'en-IN';
    utterance.rate = this.options.rate ?? 1.0;
    utterance.pitch = this.options.pitch ?? 1.0;
    utterance.volume = this.options.volume ?? 1.0;

    // Pick best natural Gemini Lady voice
    const preferredVoice = getGeminiLadyVoice(this.options.lang || 'en-IN');
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      if (this.isPaused || !this.isSpeaking) return;
      this.currentIndex++;
      if (this.currentIndex < this.chunks.length) {
        // Small delay between sentences for natural cadenced breathing
        setTimeout(() => {
          if (this.isSpeaking && !this.isPaused) {
            this.speakCurrentChunk();
          }
        }, 120);
      } else {
        this.isSpeaking = false;
        this.options.onEnd?.();
      }
    };

    utterance.onerror = (e) => {
      // 'interrupted' or 'canceled' are expected when user stops or pauses
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      console.warn('[SPARSH TTS] Chunk synthesis warning:', e.error);
      if (this.isSpeaking && !this.isPaused) {
        this.currentIndex++;
        this.speakCurrentChunk();
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}
