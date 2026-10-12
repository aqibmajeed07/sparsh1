// SPARSH VoiceVision — Activation & Session Manager
// Coordinates on-screen activation, keyboard shortcuts, wake-phrase detection,
// glasses button events, and the Screen Wake Lock API.

export interface ActivationConfig {
  enableWakePhrase?: boolean;
  enableKeyboardShortcut?: boolean;
  enableWakeLock?: boolean;
  onActivate: (trigger: 'button' | 'hotkey' | 'wake-phrase' | 'glasses-button') => void;
}

export class ActivationManager {
  private config: ActivationConfig;
  private wakeLockSentinel: any = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private customEventHandler: ((e: Event) => void) | null = null;

  constructor(config: ActivationConfig) {
    this.config = {
      enableWakePhrase: true,
      enableKeyboardShortcut: true,
      enableWakeLock: true,
      ...config,
    };
  }

  public init() {
    if (typeof window === 'undefined') return;

    // 1. Keyboard Shortcut Listener (Alt + V or Ctrl + Shift + V)
    if (this.config.enableKeyboardShortcut) {
      this.keydownHandler = (e: KeyboardEvent) => {
        // Toggle on Alt+V, or Ctrl+Shift+V
        if ((e.altKey && (e.key === 'v' || e.key === 'V')) || 
            (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V'))) {
          e.preventDefault();
          this.config.onActivate('hotkey');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }

    // 2. Hardware / Smart-Glasses Button Event Listener
    this.customEventHandler = (e: any) => {
      this.config.onActivate('glasses-button');
    };
    window.addEventListener('sparsh:glasses-button', this.customEventHandler);
  }

  public destroy() {
    if (typeof window === 'undefined') return;

    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.customEventHandler) {
      window.removeEventListener('sparsh:glasses-button', this.customEventHandler);
      this.customEventHandler = null;
    }

    this.releaseWakeLock();
  }

  /**
   * Acquire Screen Wake Lock during active voice session so screen does not sleep.
   */
  public async requestWakeLock(): Promise<boolean> {
    if (!this.config.enableWakeLock || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    try {
      if (!this.wakeLockSentinel) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
      }
      return true;
    } catch (err) {
      console.warn('[ActivationManager] Screen Wake Lock unavailable:', err);
      return false;
    }
  }

  /**
   * Release Screen Wake Lock when voice assistant returns to idle.
   */
  public async releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch (_) {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Check if transcript starts with or contains the wake phrase ("hello sparsh" or "hey sparsh").
   * Note: Web browsers do NOT support offline background wake-word detection when tab is sleeping.
   */
  public checkWakePhrase(transcript: string): { matched: boolean; stripped: string } {
    if (!transcript) return { matched: false, stripped: '' };

    const lower = transcript.toLowerCase().trim();
    const patterns = [
      /^hello\s+sparsh\b[\s,]*/i,
      /^hey\s+sparsh\b[\s,]*/i,
      /^hi\s+sparsh\b[\s,]*/i,
      /^sparsh\b[\s,]*/i,
      /^ok\s+sparsh\b[\s,]*/i,
    ];

    for (const pat of patterns) {
      if (pat.test(lower)) {
        const stripped = lower.replace(pat, '').trim();
        return { matched: true, stripped };
      }
    }

    return { matched: false, stripped: lower };
  }
}
