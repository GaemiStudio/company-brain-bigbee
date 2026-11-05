import { BrainMessageKind } from '@app-starter/shared';

/**
 * Decides whether a chat message reports a problem, reports that something
 * worked, or neither, using simple word rules.
 *
 * Why rules and not the meaning vectors: vectors capture what a sentence is
 * *about*, so "Next does nothing" and "Next works fine" come out nearly
 * identical. Telling them apart takes the words themselves.
 */

// Phrases that signal something is broken. Matched as whole words, so "fine"
// does not match inside "define".
const PROBLEM_PATTERNS: readonly RegExp[] = [
  /\bcan'?t\b/,
  /\bcannot\b/,
  /\bwon'?t\b/,
  /\bdoesn'?t work\b/,
  /\bnot working\b/,
  /\bdoes nothing\b/,
  /\bnothing happens\b/,
  /\bstuck\b/,
  /\bbroken\b/,
  /\bjammed\b/,
  /\bkeeps dropping\b/,
];

// Phrases that signal something worked.
const SUCCESS_PATTERNS: readonly RegExp[] = [
  /\bworks?\b/,
  /\bworked\b/,
  /\bfine\b/,
  /\bwent through\b/,
  /\bsubmitted\b/,
  /\bno (issues|problems|trouble)\b/,
];

export const classifyMessage = (text: string): BrainMessageKind => {
  // Curly apostrophes (’) are common in chat. Treat them like straight ones.
  const normalized = text.toLowerCase().replace(/’/g, "'");

  // Check for problems first: "doesn't work" contains "work", and it's a problem.
  if (PROBLEM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'problem';
  }
  if (SUCCESS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'success';
  }
  return 'neither';
};
