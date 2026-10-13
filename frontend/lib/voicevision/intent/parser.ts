// SPARSH VoiceVision — Intent & Entity Parser
// Normalizes transcripts, computes token-overlap and fuzzy confidence scores,
// extracts parameters (numbers, ordinals, subjects, titles), and generates clarifying questions.

export interface ParsedParameters {
  number?: number;
  ordinal?: 'first' | 'second' | 'third' | 'fourth' | 'next' | 'previous' | 'last';
  subject?: string;
  rawTarget?: string;
  query?: string;
}

export interface MatchCandidate {
  commandId: string;
  score: number;
  matchedPhrase: string;
  params: ParsedParameters;
}

export interface ParseResult {
  topMatch: MatchCandidate | null;
  needsClarification: boolean;
  clarificationQuestion?: string;
  runnerCandidate?: MatchCandidate;
  normalizedText: string;
  rawText: string;
}

const FILLER_WORDS = new Set([
  'please', 'can', 'you', 'could', 'would', 'kindly',
  'i', 'want', 'to', 'like', 'me', 'the', 'a', 'an',
  'sparsh', 'hey', 'hello', 'hi', 'ok', 'okay',
  'now', 'just', 'go', 'and', 'for', 'about'
]);

const ORDINAL_MAP: Record<string, 'first' | 'second' | 'third' | 'fourth' | 'next' | 'previous' | 'last'> = {
  'first': 'first',
  '1st': 'first',
  'second': 'second',
  '2nd': 'second',
  'third': 'third',
  '3rd': 'third',
  'fourth': 'fourth',
  '4th': 'fourth',
  'next': 'next',
  'forward': 'next',
  'previous': 'previous',
  'back': 'previous',
  'prev': 'previous',
  'last': 'last',
};

const NUMBER_WORDS: Record<string, number> = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'first': 1, 'second': 2, 'third': 3, 'fourth': 4
};

const SUBJECT_KEYWORDS = [
  'science', 'physics', 'chemistry', 'biology',
  'mathematics', 'math', 'maths', 'english', 'history',
  'geography', 'social science', 'hindi', 'computer'
];

export class IntentParser {
  /**
   * Cleans transcript by removing leading wake words, filler words, and excess whitespace.
   */
  public static normalize(raw: string): string {
    if (!raw) return '';
    let text = raw.toLowerCase().trim();

    // Strip common punctuations
    text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ');

    // Tokenize
    const tokens = text.split(/\s+/).filter(Boolean);
    const filtered = tokens.filter(tok => !FILLER_WORDS.has(tok));

    return filtered.join(' ').trim();
  }

  /**
   * Tokenizes string into unique meaningful tokens.
   */
  public static tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(tok => tok.length > 0 && !FILLER_WORDS.has(tok));
  }

  /**
   * Extracts numbers, ordinals, subject names, or search targets from text.
   */
  public static extractParameters(text: string): ParsedParameters {
    const params: ParsedParameters = {};
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    // 1. Ordinals
    for (const w of words) {
      if (ORDINAL_MAP[w]) {
        params.ordinal = ORDINAL_MAP[w];
        break;
      }
    }

    // 2. Numbers (e.g. "lesson 2", "option 3", "question 1")
    const digitMatch = lower.match(/\b\d+\b/);
    if (digitMatch) {
      params.number = parseInt(digitMatch[0], 10);
    } else {
      for (const w of words) {
        if (NUMBER_WORDS[w] !== undefined) {
          params.number = NUMBER_WORDS[w];
          break;
        }
      }
    }

    // 3. Subject Names
    for (const sub of SUBJECT_KEYWORDS) {
      if (lower.includes(sub)) {
        params.subject = sub;
        break;
      }
    }

    // 4. Raw Search Query Extraction (e.g. "search for atoms" -> "atoms", "ask tutor why is sky blue" -> "why is sky blue")
    const searchMatch = lower.match(/(?:search|find|filter|look for|about)\s+(.+)/);
    if (searchMatch && searchMatch[1]) {
      params.query = searchMatch[1].trim();
    }

    const askMatch = lower.match(/(?:ask|question|tell me)\s+(?:the\s+tutor\s+|ai\s+)?(.+)/);
    if (askMatch && askMatch[1]) {
      params.query = askMatch[1].trim();
    }

    return params;
  }

  /**
   * Calculates similarity score between candidate phrase and user input (0.0 to 1.0).
   */
  public static scoreMatch(normalizedInput: string, phrase: string): number {
    const normPhrase = IntentParser.normalize(phrase);
    if (!normPhrase || !normalizedInput) return 0;

    // Exact match
    if (normalizedInput === normPhrase) return 1.0;

    // Substring contains
    if (normalizedInput.includes(normPhrase) || normPhrase.includes(normalizedInput)) {
      const lenRatio = Math.min(normalizedInput.length, normPhrase.length) / Math.max(normalizedInput.length, normPhrase.length);
      return 0.75 + (0.2 * lenRatio);
    }

    // Token overlap (Jaccard-like score)
    const inputTokens = new Set(IntentParser.tokenize(normalizedInput));
    const phraseTokens = new Set(IntentParser.tokenize(normPhrase));

    if (inputTokens.size === 0 || phraseTokens.size === 0) return 0;

    let overlap = 0;
    phraseTokens.forEach(t => {
      if (inputTokens.has(t)) overlap++;
    });

    const union = new Set([...Array.from(inputTokens), ...Array.from(phraseTokens)]).size;
    const jaccard = overlap / union;

    // Bonus if key action verbs match (e.g., "open", "read", "take", "analyse", "capture")
    const actionWords = [
      'open', 'read', 'join', 'start', 'play', 'pause', 'stop', 'submit', 'explain',
      'take', 'snap', 'capture', 'click', 'analyse', 'analyze', 'look', 'describe', 'see', 'photo', 'image'
    ];
    let actionBonus = 0;
    for (const act of actionWords) {
      if (inputTokens.has(act) && phraseTokens.has(act)) {
        actionBonus = 0.25;
        break;
      }
    }

    return Math.min(1.0, jaccard + actionBonus);
  }

  /**
   * Matches input against a collection of commands and phrase variants.
   */
  public static parse(
    rawText: string,
    commandPhrases: { id: string; phrases: string[]; description?: string }[]
  ): ParseResult {
    const normalized = IntentParser.normalize(rawText);
    const params = IntentParser.extractParameters(rawText);

    let candidates: MatchCandidate[] = [];

    for (const cmd of commandPhrases) {
      let maxCmdScore = 0;
      let bestPhrase = '';

      for (const phrase of cmd.phrases) {
        const score = IntentParser.scoreMatch(normalized, phrase);
        if (score > maxCmdScore) {
          maxCmdScore = score;
          bestPhrase = phrase;
        }
      }

      if (maxCmdScore >= 0.3) {
        candidates.push({
          commandId: cmd.id,
          score: maxCmdScore,
          matchedPhrase: bestPhrase,
          params,
        });
      }
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    const topMatch = candidates[0] || null;
    const runnerMatch = candidates[1] || null;

    // Determine if clarification is needed (e.g. score between 0.35 and 0.60, or close runner-up)
    let needsClarification = false;
    let clarificationQuestion: string | undefined;

    if (topMatch) {
      if (
        runnerMatch &&
        runnerMatch.score >= 0.35 &&
        (topMatch.score - runnerMatch.score < 0.1) &&
        topMatch.score < 0.95
      ) {
        needsClarification = true;
        const opt1 = topMatch.matchedPhrase;
        const opt2 = runnerMatch.matchedPhrase;
        clarificationQuestion = `Did you mean ${opt1}, or ${opt2}?`;
      }
    }

    return {
      topMatch,
      needsClarification,
      clarificationQuestion,
      runnerCandidate: runnerMatch || undefined,
      normalizedText: normalized,
      rawText,
    };
  }
}
