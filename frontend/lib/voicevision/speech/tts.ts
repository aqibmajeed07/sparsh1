// SPARSH VoiceVision — Sentence-Chunked Text-to-Speech Engine
// Implements resilient sentence chunking and cancel-and-remember pause/resume
// with V8 GC pinning and Windows driver error recovery to speak all content without cutting off.

import { getGeminiLadyVoice, cleanTextForSpeech, splitIntoCleanSentences } from '@/lib/geminiVoice';

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
  private heartbeatTimer: any = null;

  constructor(options: TTSOptions = {}) {
    this.options = {
      rate: 1.0,
      pitch: 1.06,
      volume: 1.0,
      lang: 'en-US',
      ...options,
    };
  }

  public updateOptions(newOptions: Partial<TTSOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Splits long prose into natural, robust sentence chunks using the SPARSH Gemini Voice engine.
   */
  public static splitIntoSentences(text: string): string[] {
    const cleaned = cleanTextForSpeech(text);
    return splitIntoCleanSentences(cleaned);
  }

  /**
   * Speak a text string by breaking it into robust sentence chunks that never cut off after 3-4 words.
   */
  public speak(text: string, options?: Partial<TTSOptions>) {
    this.stop();
    if (options) {
      this.updateOptions(options);
    }

    const cleaned = cleanTextForSpeech(text);
    this.chunks = splitIntoCleanSentences(cleaned);
    this.currentIndex = 0;
    this.isPaused = false;

    if (this.chunks.length === 0) {
      this.options.onEnd?.();
      return;
    }

    this.isSpeaking = true;

    // Windows Audio Driver Settling Buffer (80ms)
    setTimeout(() => {
      if (this.isSpeaking && !this.isPaused) {
        this.startHeartbeat();
        this.speakCurrentChunk();
      }
    }, 80);
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else if (!this.isSpeaking) {
          this.clearHeartbeat();
        }
      }
    }, 8000);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Resilient Pause: Cancels native speech synthesis immediately and preserves
   * current chunk index, because native pause() is unreliable on Android Chrome.
   */
  public pause() {
    if (!this.isSpeaking || this.isPaused) return;

    this.isPaused = true;
    this.clearHeartbeat();
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
    this.startHeartbeat();
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
    this.clearHeartbeat();

    if (typeof window !== 'undefined') {
      (window as any).__sparsh_voicevision_utterance = null;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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
      this.clearHeartbeat();
      this.options.onEnd?.();
      return;
    }

    const chunkText = this.chunks[this.currentIndex];
    this.options.onChunkChange?.(this.currentIndex, this.chunks.length, chunkText);

    try {
      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = this.options.lang || 'en-US';
      utterance.rate = this.options.rate ?? 1.0;
      utterance.pitch = this.options.pitch ?? 1.06;
      utterance.volume = this.options.volume ?? 1.0;

      // Pick best natural Gemini Lady voice
      const preferredVoice = getGeminiLadyVoice(this.options.lang || 'en-US');
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // GC PINNING: Prevents V8 Garbage Collector from killing speech midway!
      if (typeof window !== 'undefined') {
        (window as any).__sparsh_voicevision_utterance = utterance;
      }

      utterance.onend = () => {
        if (this.isPaused || !this.isSpeaking) return;
        this.currentIndex++;
        if (this.currentIndex < this.chunks.length) {
          // 80ms WASAPI buffer allows audio devices to cycle cleanly
          setTimeout(() => {
            if (this.isSpeaking && !this.isPaused) {
              this.speakCurrentChunk();
            }
          }, 80);
        } else {
          this.isSpeaking = false;
          this.clearHeartbeat();
          this.options.onEnd?.();
        }
      };

      utterance.onerror = (e) => {
        // CRITICAL: If audio driver throws 'interrupted', do NOT abort!
        // Advance to next chunk smoothly.
        if (this.isSpeaking && !this.isPaused) {
          console.warn('[SPARSH TTS] Chunk notification:', e.error, '- continuing next sentence');
          this.currentIndex++;
          setTimeout(() => {
            if (this.isSpeaking && !this.isPaused) {
              this.speakCurrentChunk();
            }
          }, 100);
        }
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SPARSH TTS] Utterance error, advancing:', err);
      if (this.isSpeaking && !this.isPaused) {
        this.currentIndex++;
        setTimeout(() => {
          if (this.isSpeaking && !this.isPaused) {
            this.speakCurrentChunk();
          }
        }, 100);
      }
    }
  }
}
