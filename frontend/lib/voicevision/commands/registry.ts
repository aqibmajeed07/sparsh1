// SPARSH VoiceVision — Command Registry & Dispatcher
// Manages global and page-scoped voice commands, auto-unregistration on unmount,
// and execution dispatch with confirmation checks.

import { useEffect } from 'react';
import { VoiceCommand, CommandContext, CommandResult } from './types';
import { IntentParser, ParseResult } from '../intent/parser';
import { SpokenConfirmationManager } from './confirm';

export class CommandRegistry {
  private globalCommands: VoiceCommand[] = [];
  private pageCommandsMap: Map<string, VoiceCommand[]> = new Map();
  public confirmationManager: SpokenConfirmationManager = new SpokenConfirmationManager();

  constructor() {
    this.registerDefaultGlobalCommands();
  }

  /**
   * Registers a global command available everywhere in the app.
   */
  public registerGlobalCommand(command: VoiceCommand) {
    this.globalCommands = this.globalCommands.filter(c => c.id !== command.id);
    this.globalCommands.push(command);
  }

  /**
   * Registers page-scoped commands under a unique key.
   */
  public registerPageCommands(pageKey: string, commands: VoiceCommand[]) {
    this.pageCommandsMap.set(pageKey, commands);
  }

  /**
   * Unregisters page-scoped commands when component unmounts.
   */
  public unregisterPageCommands(pageKey: string) {
    this.pageCommandsMap.delete(pageKey);
  }

  /**
   * Retrieves all commands valid for the given pathname.
   */
  public getActiveCommands(pathname: string): VoiceCommand[] {
    const active: VoiceCommand[] = [...this.globalCommands];

    this.pageCommandsMap.forEach((commands) => {
      for (const cmd of commands) {
        if (cmd.scope === 'global') {
          active.push(cmd);
        } else if (typeof cmd.scope === 'function') {
          if (cmd.scope(pathname)) {
            active.push(cmd);
          }
        }
      }
    });

    return active;
  }

  /**
   * Resolves a voice transcript into an active command and executes it.
   */
  public async dispatch(
    rawTranscript: string,
    context: CommandContext
  ): Promise<{ handled: boolean; result?: CommandResult; message?: string }> {
    // 1. If currently waiting for a verbal yes/no confirmation, handle that first!
    if (this.confirmationManager.isWaitingForConfirmation()) {
      const handled = this.confirmationManager.handleTranscript(rawTranscript, context.speak);
      return { handled: true };
    }

    const activeCommands = this.getActiveCommands(context.pathname);

    // 2. Parse intent
    const parseResult: ParseResult = IntentParser.parse(
      rawTranscript,
      activeCommands.map(c => ({
        id: c.id,
        phrases: c.phrases,
        description: c.description,
      }))
    );

    // 3. Check if clarification question is warranted
    if (parseResult.needsClarification && parseResult.clarificationQuestion) {
      context.speak(parseResult.clarificationQuestion);
      return {
        handled: true,
        message: parseResult.clarificationQuestion,
      };
    }

    // 4. If a command matched with acceptable confidence (>= 0.45)
    if (parseResult.topMatch && parseResult.topMatch.score >= 0.45) {
      const matchedCmd = activeCommands.find(c => c.id === parseResult.topMatch!.commandId);
      if (matchedCmd) {
        // Enforce verbal confirmation if required
        if (matchedCmd.requiresConfirmation) {
          const prompt = matchedCmd.confirmationPrompt
            ? matchedCmd.confirmationPrompt(context)
            : `Are you sure you want to execute ${matchedCmd.description}?`;

          const confirmed = await this.confirmationManager.requestConfirmation(prompt, context.speak);
          if (!confirmed) {
            return { handled: true, message: 'Action cancelled by user.' };
          }
        }

        // Execute handler
        try {
          const enrichedContext: CommandContext = {
            ...context,
            params: parseResult.topMatch.params,
            rawTranscript,
          };
          const res = await matchedCmd.handler(enrichedContext);
          return { handled: true, result: res || undefined };
        } catch (err: any) {
          console.error(`[CommandRegistry] Error executing ${matchedCmd.id}:`, err);
          context.speak('Sorry, there was an error performing that action.');
          return { handled: false, message: err?.message };
        }
      }
    }

    // 5. Fallback: Query SPARSH AI Tutor or report unrecognized command
    return { handled: false };
  }

  /**
   * Built-in default global navigation, playback, and help commands.
   */
  private registerDefaultGlobalCommands() {
    // Navigation: Dashboard
    this.registerGlobalCommand({
      id: 'global-nav-dashboard',
      phrases: ['open my dashboard', 'open dashboard', 'go to dashboard', 'go home', 'return to dashboard', 'home page'],
      description: 'Go to your student dashboard',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening dashboard.');
        ctx.navigate('/student');
      },
    });

    // Navigation: Online Classes
    this.registerGlobalCommand({
      id: 'global-nav-classes',
      phrases: ['open my classes', 'open online classes', 'show my online classes', 'what classes do i have', 'upcoming classes', 'go to live class'],
      description: 'Open online classroom sessions',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening online classes.');
        ctx.navigate('/student/live-class');
      },
    });

    // Navigation: Lessons
    this.registerGlobalCommand({
      id: 'global-nav-lessons',
      phrases: ['open lessons', 'show lessons', 'go to lessons', 'list lessons', 'ncert lessons', 'open courses'],
      description: 'Open NCERT syllabus lessons',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening lessons.');
        ctx.navigate('/student/lessons');
      },
    });

    // Navigation: AI Tutor
    this.registerGlobalCommand({
      id: 'global-nav-ai-tutor',
      phrases: ['open ai tutor', 'ask ai tutor', 'go to ai tutor', 'talk to ai tutor', 'ncert tutor'],
      description: 'Open NCERT AI Tutor',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening AI Tutor.');
        ctx.navigate('/student/ai-tutor');
      },
    });

    // Navigation: Assessments
    this.registerGlobalCommand({
      id: 'global-nav-assessments',
      phrases: ['open assessments', 'show assessments', 'go to quizzes', 'open quizzes', 'show my tests', 'take test'],
      description: 'Open assessments and quizzes',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening assessments.');
        ctx.navigate('/student/assessments');
      },
    });

    // Navigation: Profile
    this.registerGlobalCommand({
      id: 'global-nav-profile',
      phrases: ['open my profile', 'show profile', 'go to profile', 'my account', 'student profile'],
      description: 'Open your student profile',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening profile.');
        ctx.navigate('/student/profile');
      },
    });

    // Navigation: Rewards
    this.registerGlobalCommand({
      id: 'global-nav-rewards',
      phrases: ['open rewards', 'show my badges', 'check rewards', 'my streak', 'my points'],
      description: 'Open rewards and badges',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Opening rewards and achievements.');
        ctx.navigate('/student/rewards');
      },
    });

    // Navigation: History Go Back
    this.registerGlobalCommand({
      id: 'global-nav-back',
      phrases: ['go back', 'previous page', 'take me back'],
      description: 'Go back to previous page',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('Going back.');
        if (typeof window !== 'undefined') window.history.back();
      },
    });

    // Introspection: What can I do here?
    this.registerGlobalCommand({
      id: 'global-help-what-can-i-do',
      phrases: ['what can i do here', 'what are the commands', 'available commands', 'list commands'],
      description: 'Lists all commands available on the current page',
      scope: 'global',
      handler: async (ctx) => {
        const active = this.getActiveCommands(ctx.pathname);
        const descriptions = active
          .slice(0, 5)
          .map(c => c.phrases[0])
          .join(', ');
        ctx.speak(`On this page you can say: ${descriptions}. Or say help for more options.`);
      },
    });

    // Help
    this.registerGlobalCommand({
      id: 'global-help-overview',
      phrases: ['help', 'help me', 'how to use voice', 'voice instructions'],
      description: 'Provides speech guidance and tips',
      scope: 'global',
      handler: async (ctx) => {
        ctx.speak('SPARSH VoiceVision is active. You can say open dashboard, open online classes, open lessons, read this lesson, pause, or ask the AI tutor any question.');
      },
    });

    // Playback: Stop / Pause / Resume / Repeat
    this.registerGlobalCommand({
      id: 'global-speech-pause',
      phrases: ['pause reading', 'pause audio', 'pause'],
      description: 'Pause reading at the current sentence',
      scope: 'global',
      handler: async (ctx) => {
        ctx.tts.pause();
      },
    });

    this.registerGlobalCommand({
      id: 'global-speech-resume',
      phrases: ['resume reading', 'resume audio', 'resume', 'continue reading'],
      description: 'Resume reading from current sentence',
      scope: 'global',
      handler: async (ctx) => {
        ctx.tts.resume();
      },
    });

    this.registerGlobalCommand({
      id: 'global-speech-stop',
      phrases: ['stop reading', 'stop', 'be quiet', 'cancel speech'],
      description: 'Stop all speech output',
      scope: 'global',
      handler: async (ctx) => {
        ctx.tts.stop();
      },
    });

    this.registerGlobalCommand({
      id: 'global-speech-repeat',
      phrases: ['repeat that', 'repeat sentence', 'say that again', 'repeat'],
      description: 'Repeat the last spoken sentence',
      scope: 'global',
      handler: async (ctx) => {
        ctx.tts.repeat();
      },
    });

    // TTS Rate Controls: Louder / Slower / Faster
    this.registerGlobalCommand({
      id: 'global-tts-slower',
      phrases: ['slower', 'speak slower', 'read slower'],
      description: 'Decrease speech rate',
      scope: 'global',
      handler: async (ctx) => {
        ctx.tts.updateOptions({ rate: 0.85 });
        ctx.speak('Speaking slower now.');
      },
    });

    this.registerGlobalCommand({
      id: 'global-tts-faster',
      phrases: ['faster', 'speak faster', 'read faster'],
      description: 'Increase speech rate',
      scope: 'global',
      handler: async (ctx) => {
        ctx.tts.updateOptions({ rate: 1.15 });
        ctx.speak('Speaking faster now.');
      },
    });

    // Security: Log out with verbal confirmation
    this.registerGlobalCommand({
      id: 'global-auth-logout',
      phrases: ['log out', 'sign out', 'logout of sparsh', 'exit account'],
      description: 'Log out of SPARSH account with confirmation',
      scope: 'global',
      requiresConfirmation: true,
      confirmationPrompt: () => 'Are you sure you want to log out of SPARSH?',
      handler: async (ctx) => {
        ctx.speak('Logging you out of SPARSH.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sparsh_user');
          sessionStorage.clear();
        }
        // Dispatch signout event or call Supabase auth
        try {
          const { supabase } = await import('@/lib/supabase');
          await supabase.auth.signOut();
        } catch (_) {}
        ctx.navigate('/login');
      },
    });
  }
}

// Global shared registry singleton instance
export const globalCommandRegistry = new CommandRegistry();

/**
 * React hook allowing page components to register page-scoped voice commands
 * that automatically unregister when the page unmounts.
 */
export function useVoiceCommands(pageKey: string, commands: VoiceCommand[]) {
  useEffect(() => {
    globalCommandRegistry.registerPageCommands(pageKey, commands);

    return () => {
      globalCommandRegistry.unregisterPageCommands(pageKey);
    };
  }, [pageKey, commands]);
}
