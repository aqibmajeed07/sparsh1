// SPARSH VoiceVision — Spoken Confirmation Manager
// Enforces verbal verification before irreversible actions (logout, submit quiz, delete).

export interface ConfirmationSession {
  id: string;
  prompt: string;
  resolve: (confirmed: boolean) => void;
  timer: any;
}

export class SpokenConfirmationManager {
  private activeSession: ConfirmationSession | null = null;

  public isWaitingForConfirmation(): boolean {
    return this.activeSession !== null;
  }

  public getActivePrompt(): string | null {
    return this.activeSession ? this.activeSession.prompt : null;
  }

  /**
   * Prompts user with prompt text and waits for a spoken "yes" or "no".
   */
  public requestConfirmation(
    promptText: string,
    speak: (text: string) => void,
    timeoutMs: number = 10000
  ): Promise<boolean> {
    // Abort any existing pending confirmation
    if (this.activeSession) {
      this.cancel('Replaced by new confirmation request');
    }

    return new Promise<boolean>((resolve) => {
      const sessionId = `confirm-${Date.now()}`;

      const timer = setTimeout(() => {
        if (this.activeSession && this.activeSession.id === sessionId) {
          this.activeSession = null;
          speak('Confirmation timed out. Action cancelled.');
          resolve(false);
        }
      }, timeoutMs);

      this.activeSession = {
        id: sessionId,
        prompt: promptText,
        resolve,
        timer,
      };

      // Speak confirmation question
      speak(`${promptText} Say yes to confirm, or no to cancel.`);
    });
  }

  /**
   * Checks if an incoming transcript is a yes/no response to an active confirmation prompt.
   */
  public handleTranscript(transcript: string, speak: (text: string) => void): boolean {
    if (!this.activeSession) return false;

    const lower = transcript.toLowerCase().trim();

    const YES_WORDS = ['yes', 'yeah', 'yep', 'confirm', 'proceed', 'sure', 'do it', 'okay', 'ok', 'haan', 'sahi'];
    const NO_WORDS = ['no', 'nah', 'cancel', 'stop', 'abort', 'dont', "don't", 'never', 'nahi'];

    for (const w of YES_WORDS) {
      if (lower === w || lower.startsWith(w + ' ') || lower.endsWith(' ' + w)) {
        clearTimeout(this.activeSession.timer);
        const resolve = this.activeSession.resolve;
        this.activeSession = null;
        resolve(true);
        return true;
      }
    }

    for (const w of NO_WORDS) {
      if (lower === w || lower.startsWith(w + ' ') || lower.endsWith(' ' + w)) {
        clearTimeout(this.activeSession.timer);
        const resolve = this.activeSession.resolve;
        this.activeSession = null;
        speak('Action cancelled.');
        resolve(false);
        return true;
      }
    }

    // If ambiguous input while confirming, remind them
    speak('Please say yes to confirm or no to cancel.');
    return true;
  }

  public cancel(reason?: string) {
    if (this.activeSession) {
      clearTimeout(this.activeSession.timer);
      const resolve = this.activeSession.resolve;
      this.activeSession = null;
      resolve(false);
    }
  }
}
