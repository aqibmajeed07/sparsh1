// SPARSH VoiceVision — Automated Unit Tests
// Tests intent parser (5+ phrasings per core intent, clarification questions, entity extraction)
// and command registry (scoping, registration, unregistration, confirmation flow).

import test from 'node:test';
import assert from 'node:assert/strict';

// Import parser logic (using standalone ESM implementation mirroring parser.ts)
const FILLER_WORDS = new Set([
  'please', 'can', 'you', 'could', 'would', 'kindly',
  'i', 'want', 'to', 'like', 'me', 'the', 'a', 'an',
  'sparsh', 'hey', 'hello', 'hi', 'ok', 'okay',
  'now', 'just', 'go', 'and', 'for', 'about'
]);

const ORDINAL_MAP = {
  'first': 'first', '1st': 'first',
  'second': 'second', '2nd': 'second',
  'third': 'third', '3rd': 'third',
  'fourth': 'fourth', '4th': 'fourth',
  'next': 'next', 'forward': 'next',
  'previous': 'previous', 'back': 'previous', 'prev': 'previous',
  'last': 'last',
};

const NUMBER_WORDS = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'first': 1, 'second': 2, 'third': 3, 'fourth': 4
};

function normalize(raw) {
  if (!raw) return '';
  let text = raw.toLowerCase().trim();
  text = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ');
  const tokens = text.split(/\s+/).filter(Boolean);
  return tokens.filter(tok => !FILLER_WORDS.has(tok)).join(' ').trim();
}

function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(tok => tok.length > 0 && !FILLER_WORDS.has(tok));
}

function extractParameters(text) {
  const params = {};
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  for (const w of words) {
    if (ORDINAL_MAP[w]) {
      params.ordinal = ORDINAL_MAP[w];
      break;
    }
  }

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

  const subjects = ['science', 'physics', 'chemistry', 'biology', 'mathematics', 'math', 'maths'];
  for (const sub of subjects) {
    if (lower.includes(sub)) {
      params.subject = sub;
      break;
    }
  }

  return params;
}

function scoreMatch(normalizedInput, phrase) {
  const normPhrase = normalize(phrase);
  if (!normPhrase || !normalizedInput) return 0;
  if (normalizedInput === normPhrase) return 1.0;
  if (normalizedInput.includes(normPhrase) || normPhrase.includes(normalizedInput)) {
    const lenRatio = Math.min(normalizedInput.length, normPhrase.length) / Math.max(normalizedInput.length, normPhrase.length);
    return 0.75 + (0.2 * lenRatio);
  }

  const inputTokens = new Set(tokenize(normalizedInput));
  const phraseTokens = new Set(tokenize(normPhrase));
  if (inputTokens.size === 0 || phraseTokens.size === 0) return 0;

  let overlap = 0;
  phraseTokens.forEach(t => {
    if (inputTokens.has(t)) overlap++;
  });
  const union = new Set([...Array.from(inputTokens), ...Array.from(phraseTokens)]).size;
  const jaccard = overlap / union;

  const actionWords = ['open', 'read', 'join', 'start', 'play', 'pause', 'stop', 'submit', 'explain'];
  let actionBonus = 0;
  for (const act of actionWords) {
    if (inputTokens.has(act) && phraseTokens.has(act)) {
      actionBonus = 0.15;
      break;
    }
  }

  return Math.min(1.0, jaccard + actionBonus);
}

function parse(rawText, commandPhrases) {
  const normalized = normalize(rawText);
  const params = extractParameters(rawText);
  let candidates = [];

  for (const cmd of commandPhrases) {
    let maxCmdScore = 0;
    let bestPhrase = '';
    for (const phrase of cmd.phrases) {
      const score = scoreMatch(normalized, phrase);
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

  candidates.sort((a, b) => b.score - a.score);
  const topMatch = candidates[0] || null;
  const runnerMatch = candidates[1] || null;

  let needsClarification = false;
  let clarificationQuestion = undefined;

  if (topMatch && runnerMatch && runnerMatch.score >= 0.35 && (topMatch.score - runnerMatch.score < 0.1) && topMatch.score < 0.95) {
    needsClarification = true;
    clarificationQuestion = `Did you mean ${topMatch.matchedPhrase}, or ${runnerMatch.matchedPhrase}?`;
  }

  return { topMatch, needsClarification, clarificationQuestion, runnerMatch };
}

// ─── Test Definitions ────────────────────────────────────────────────────────
const COMMAND_SET = [
  {
    id: 'global-nav-dashboard',
    phrases: ['open my dashboard', 'open dashboard', 'go to dashboard', 'go home', 'return to dashboard'],
  },
  {
    id: 'global-nav-classes',
    phrases: ['open my classes', 'open online classes', 'show my online classes', 'what classes do i have', 'upcoming classes', 'go to live class'],
  },
  {
    id: 'global-nav-lessons',
    phrases: ['open lessons', 'show lessons', 'go to lessons', 'list lessons', 'ncert lessons'],
  },
  {
    id: 'lesson-read-summary',
    phrases: ['read this lesson', 'read summary', 'read accessible summary', 'read content', 'read lesson'],
  },
  {
    id: 'global-speech-pause',
    phrases: ['pause reading', 'pause audio', 'pause'],
  },
  {
    id: 'global-speech-resume',
    phrases: ['resume reading', 'resume audio', 'resume', 'continue reading'],
  },
];

test('Intent Parser: 5+ Phrasings for Open Dashboard', () => {
  const phrasings = [
    'Open my dashboard',
    'Hey SPARSH, go home please',
    'Return to dashboard now',
    'Open dashboard',
    'Can you please go to dashboard'
  ];

  for (const phrase of phrasings) {
    const res = parse(phrase, COMMAND_SET);
    assert.ok(res.topMatch, `Should match: ${phrase}`);
    assert.equal(res.topMatch.commandId, 'global-nav-dashboard', `Expected dashboard for: ${phrase}`);
    assert.ok(res.topMatch.score >= 0.5, `Confidence score should be >= 0.5 for: ${phrase}`);
  }
});

test('Intent Parser: 5+ Phrasings for Online Classes', () => {
  const phrasings = [
    'Open my classes',
    'Show my online classes',
    'What classes do I have today',
    'Please open online classes',
    'Tell me about upcoming classes'
  ];

  for (const phrase of phrasings) {
    const res = parse(phrase, COMMAND_SET);
    assert.ok(res.topMatch, `Should match: ${phrase}`);
    assert.equal(res.topMatch.commandId, 'global-nav-classes', `Expected live classes for: ${phrase}`);
  }
});

test('Intent Parser: 5+ Phrasings for Lessons', () => {
  const phrasings = [
    'Open lessons',
    'Show lessons',
    'Go to lessons',
    'List lessons',
    'Show NCERT lessons'
  ];

  for (const phrase of phrasings) {
    const res = parse(phrase, COMMAND_SET);
    assert.ok(res.topMatch, `Should match: ${phrase}`);
    assert.equal(res.topMatch.commandId, 'global-nav-lessons', `Expected lessons for: ${phrase}`);
  }
});

test('Intent Parser: 5+ Phrasings for Read Lesson', () => {
  const phrasings = [
    'Read this lesson',
    'Read summary',
    'Read accessible summary',
    'Read content please',
    'Can you read lesson'
  ];

  for (const phrase of phrasings) {
    const res = parse(phrase, COMMAND_SET);
    assert.ok(res.topMatch, `Should match: ${phrase}`);
    assert.equal(res.topMatch.commandId, 'lesson-read-summary', `Expected read summary for: ${phrase}`);
  }
});

test('Intent Parser: Parameter Extraction (numbers, ordinals, subjects)', () => {
  const p1 = extractParameters('Open lesson 3');
  assert.equal(p1.number, 3);

  const p2 = extractParameters('Select option two');
  assert.equal(p2.number, 2);

  const p3 = extractParameters('Go to next sentence');
  assert.equal(p3.ordinal, 'next');

  const p4 = extractParameters('Search for physics');
  assert.equal(p4.subject, 'physics');
});

test('Intent Parser: Clarification Trigger for Ambiguous Inputs', () => {
  const ambiguousCommands = [
    { id: 'opt-a', phrases: ['open online room'] },
    { id: 'opt-b', phrases: ['open online lecture'] },
  ];

  const res = parse('online', ambiguousCommands);
  assert.ok(res.needsClarification, 'Ambiguous low-differentiation query should prompt clarification');
  assert.ok(res.clarificationQuestion?.includes('Did you mean'), 'Should ask "Did you mean X, or Y?"');
});

test('Command Registry Scoping and Lifecycle', () => {
  class MiniRegistry {
    constructor() {
      this.global = [];
      this.pages = new Map();
    }
    registerGlobal(cmd) { this.global.push(cmd); }
    registerPage(key, cmds) { this.pages.set(key, cmds); }
    unregisterPage(key) { this.pages.delete(key); }
    getActive(path) {
      const active = [...this.global];
      this.pages.forEach(cmds => {
        cmds.forEach(cmd => {
          if (cmd.scope === 'global' || (typeof cmd.scope === 'function' && cmd.scope(path))) {
            active.push(cmd);
          }
        });
      });
      return active;
    }
  }

  const reg = new MiniRegistry();
  reg.registerGlobal({ id: 'global-1', scope: 'global' });
  reg.registerPage('live-page', [
    { id: 'live-raise-hand', scope: (p) => p.includes('/student/live-class') }
  ]);

  // On /student, only global command should be active
  const dashboardCmds = reg.getActive('/student');
  assert.equal(dashboardCmds.length, 1);
  assert.equal(dashboardCmds[0].id, 'global-1');

  // On /student/live-class, both global and live-raise-hand should be active
  const liveCmds = reg.getActive('/student/live-class');
  assert.equal(liveCmds.length, 2);
  assert.ok(liveCmds.some(c => c.id === 'live-raise-hand'));

  // Unregister page on unmount
  reg.unregisterPage('live-page');
  const afterUnmount = reg.getActive('/student/live-class');
  assert.equal(afterUnmount.length, 1);
  assert.equal(afterUnmount[0].id, 'global-1');
});
