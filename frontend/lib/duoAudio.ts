/**
 * Pure Web Audio API & Haptic Engine for Duolingo-style gamified learning.
 * Synthesizes dynamic musical chimes, clicks, buzzing, victory fanfares,
 * and pitch-graded tactile audio tones for blind learners without external audio files.
 */

import { speakGeminiLady, stopGeminiLady } from './geminiVoice';

class DuoAudioEngine {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Delightful Duolingo-style correct answer chime (Major 3rd / 5th chord flourish)
   */
  public playSuccessChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });

    this.vibrate([40, 30, 80]);
  }

  /**
   * Gentle two-tone "uh-oh" buzzer for incorrect attempts
   */
  public playErrorBuzz() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(130, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);

    this.vibrate([120, 60, 120]);
  }

  /**
   * Celebratory victory fanfare for level completion / chest opening
   */
  public playVictoryFanfare() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.0, d: 0.12 }, // C5
      { f: 659.25, t: 0.12, d: 0.12 }, // E5
      { f: 783.99, t: 0.24, d: 0.12 }, // G5
      { f: 1046.5, t: 0.36, d: 0.35 }, // C6
      { f: 880.0, t: 0.72, d: 0.15 }, // A5
      { f: 1046.5, t: 0.88, d: 0.5 }, // C6 high
    ];

    melody.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, now + note.t);

      gain.gain.setValueAtTime(0, now + note.t);
      gain.gain.linearRampToValueAtTime(0.3, now + note.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.t);
      osc.stop(now + note.t + note.d + 0.05);
    });

    this.vibrate([50, 40, 50, 40, 150]);
  }

  /**
   * Tactile pitch tone for each of the 6 Braille dots so blind students can audibly
   * localize dot position (Dot 1 = C4, Dot 2 = D4, Dot 3 = E4, Dot 4 = G4, Dot 5 = A4, Dot 6 = C5)
   */
  public playBrailleDotTone(dotNumber: number) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const dotFreqs: Record<number, number> = {
      1: 261.63, // C4
      2: 293.66, // D4
      3: 329.63, // E4
      4: 392.0,  // G4
      5: 440.0,  // A4
      6: 523.25, // C5
    };

    const freq = dotFreqs[dotNumber] || 440;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);

    this.vibrate([25]);
  }

  /**
   * Crisp button pop / UI tap
   */
  public playTapSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);

    this.vibrate([15]);
  }

  /**
   * Haptic feedback helper with graceful browser fallback
   */
  public vibrate(pattern: number | number[]) {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignored if user hasn't interacted or device doesn't support
      }
    }
  }

  /**
   * Speaks accessible instructions aloud via Gemini Lady Voice Synthesizer
   */
  public speakPrompt(text: string, lang = 'en-US') {
    speakGeminiLady(text, {
      lang,
      pitch: 1.06,
      rate: 1.0,
    });
  }

  public stopSpeaking() {
    stopGeminiLady();
  }
}

export const duoAudio = new DuoAudioEngine();
