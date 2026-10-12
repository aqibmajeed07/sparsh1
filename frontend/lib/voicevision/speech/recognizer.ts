// SPARSH VoiceVision — Speech Recognition Manager
// Enforces a strict singleton instance so two recognizers can NEVER run simultaneously.
// Supports push-to-talk, continuous listening mode with visibility check, and Indian English/regional locales.

export type RecognizerErrorType =
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'audio-capture'
  | 'aborted'
  | 'unsupported'
  | 'other';

export interface RecognizerCallbacks {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: RecognizerErrorType, userMessage: string) => void;
  onEnd?: () => void;
}

export class SpeechRecognizer {
  private static activeInstance: SpeechRecognizer | null = null;

  private recognition: any = null;
  private isListening: boolean = false;
  private listeningMode: boolean = false; // continuous restart mode
  private lang: string = 'en-IN';
  private callbacks: RecognizerCallbacks = {};
  private restartTimer: any = null;
  private consecutiveNoSpeechCount: number = 0;
  private isPausedForTTS: boolean = false;

  constructor(lang: string = 'en-IN', callbacks: RecognizerCallbacks = {}) {
    this.lang = lang;
    this.callbacks = callbacks;
  }

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public setCallbacks(callbacks: Partial<RecognizerCallbacks>) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setLang(newLang: string) {
    this.lang = newLang;
    if (this.recognition) {
      this.recognition.lang = newLang;
    }
  }

  public getLang(): string {
    return this.lang;
  }

  public getStatus() {
    return {
      isListening: this.isListening,
      listeningMode: this.listeningMode,
      isPausedForTTS: this.isPausedForTTS,
      lang: this.lang,
    };
  }

  /**
   * Pause recognition while TTS is speaking so the assistant doesn't hear itself.
   */
  public pauseForTTS() {
    this.isPausedForTTS = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
    }
  }

  /**
   * Resume recognition after TTS finishes speaking.
   */
  public resumeAfterTTS() {
    this.isPausedForTTS = false;
    if (this.listeningMode && !this.isListening) {
      this.scheduleRestart(250);
    }
  }

  /**
   * Start listening. If continuous is true, listening mode is turned on.
   */
  public start(continuous: boolean = false): boolean {
    if (!SpeechRecognizer.isSupported()) {
      this.callbacks.onError?.('unsupported', 'Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    // Stop any previously active global instance
    if (SpeechRecognizer.activeInstance && SpeechRecognizer.activeInstance !== this) {
      SpeechRecognizer.activeInstance.stop();
    }
    SpeechRecognizer.activeInstance = this;

    this.listeningMode = continuous;
    this.consecutiveNoSpeechCount = 0;

    if (this.isListening) return true;

    return this.spawnAndStart();
  }

  /**
   * Stop listening and exit continuous listening mode.
   */
  public stop() {
    this.listeningMode = false;
    this.isListening = false;
    this.isPausedForTTS = false;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    if (SpeechRecognizer.activeInstance === this) {
      SpeechRecognizer.activeInstance = null;
    }

    this.callbacks.onEnd?.();
  }

  private scheduleRestart(delayMs: number = 400) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      if (this.listeningMode && !this.isListening && !this.isPausedForTTS) {
        // Only restart if browser page is actually visible
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          this.spawnAndStart();
        }
      }
    }, delayMs);
  }

  private spawnAndStart(): boolean {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();

      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = this.lang || 'en-IN';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.isListening = true;
        this.callbacks.onStart?.();
      };

      rec.onresult = (event: any) => {
        this.consecutiveNoSpeechCount = 0;
        const lastIdx = event.results.length - 1;
        const result = event.results[lastIdx];
        if (result && result[0]) {
          const transcript = result[0].transcript.trim();
          const isFinal = result.isFinal !== false;
          this.callbacks.onResult?.(transcript, isFinal);
        }
      };

      rec.onerror = (e: any) => {
        const errorKey = e?.error || 'other';

        if (errorKey === 'aborted') {
          // Normal during program-directed stop/pause
          return;
        }

        let userMessage = 'Speech recognition issue.';
        let shouldStop = false;

        switch (errorKey) {
          case 'not-allowed':
          case 'service-not-allowed':
            userMessage = 'Microphone permission blocked. Please allow microphone access.';
            shouldStop = true;
            break;
          case 'audio-capture':
            userMessage = 'No microphone detected. Please check your audio input device.';
            shouldStop = true;
            break;
          case 'network':
            userMessage = 'Speech recognition network error. Please verify your internet connection.';
            break;
          case 'no-speech':
            userMessage = 'No speech heard.';
            this.consecutiveNoSpeechCount++;
            if (this.consecutiveNoSpeechCount > 4) {
              // Pause loop after 5 silent intervals to avoid draining CPU/battery
              shouldStop = true;
            }
            break;
          default:
            userMessage = `Speech recognition error: ${errorKey}`;
        }

        this.callbacks.onError?.(errorKey as RecognizerErrorType, userMessage);

        if (shouldStop) {
          this.stop();
        }
      };

      rec.onend = () => {
        this.isListening = false;
        this.recognition = null;

        // Auto-restart if listening mode is on, not paused for TTS, and tab is visible
        if (
          this.listeningMode &&
          !this.isPausedForTTS &&
          this.consecutiveNoSpeechCount <= 4 &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible'
        ) {
          this.scheduleRestart(350);
        } else {
          this.callbacks.onEnd?.();
        }
      };

      this.recognition = rec;
      rec.start();
      return true;
    } catch (err: any) {
      if (err?.name === 'InvalidStateError') {
        this.isListening = true;
        return true;
      }
      this.callbacks.onError?.('other', 'Unable to start speech recognition.');
      return false;
    }
  }
}
