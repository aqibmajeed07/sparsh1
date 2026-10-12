// SPARSH VoiceVision — Command System Types

import { ParsedParameters } from '../intent/parser';
import { SentenceChunkedTTS } from '../speech/tts';

export interface CommandContext {
  transcript: string;
  rawTranscript: string;
  params: ParsedParameters;
  pathname: string;
  speak: (text: string, onDone?: () => void) => void;
  navigate: (path: string) => void;
  confirm: (promptText: string) => Promise<boolean>;
  tts: SentenceChunkedTTS;
}

export interface CommandResult {
  handled: boolean;
  spokenMessage?: string;
  actionDescription?: string;
}

export interface VoiceCommand {
  id: string;
  phrases: string[];
  description: string;
  scope: 'global' | ((pathname: string) => boolean);
  requiresConfirmation?: boolean;
  confirmationPrompt?: (ctx: CommandContext) => string;
  handler: (ctx: CommandContext) => Promise<CommandResult | void>;
}
