import { BrainMessageKind } from '@app-starter/shared';

/**
 * Decides whether a chat message reports a problem, reports that something
 * worked, or neither, using simple word rules.
 *
 * Why rules and not the meaning vectors: vectors capture what a sentence is
 * *about*, so "Next does nothing" and "Next works fine" come out nearly
 * identical. Telling them apart takes the words themselves.
 */

// A negation followed (at most one word later, as in "doesn't even load") by
// a verb that means "the thing got done". People phrase the same complaint
// many ways live, e.g. "hive isn't working for me either".
const NEGATION = String.raw`(?:not|isn'?t|doesn'?t|won'?t|can'?t|cannot|couldn'?t|didn'?t)`;
const DONE_VERB = String.raw`(?:work|works|working|load|loading|click|submit|open|go through|let me)`;

// Phrases that signal something is broken. Matched as whole words, so "fine"
// does not match inside "define".
const PROBLEM_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`\b${NEGATION}\s+(?:\w+\s+)?${DONE_VERB}\b`),
  /\bcan'?t\b/,
  /\bcannot\b/,
  /\bwon'?t\b/,
  /\bdoes nothing\b/,
  /\bnothing happens\b/,
  /\bstuck\b/,
  /\bbroken\b/,
  /\bjammed\b/,
  /\bkeeps (?:dropping|failing)\b/,
  /\berrors?\b/,
  // Pile-ons: someone saying they have the same trouble as the others.
  /\bsame (?:issue|problem)\b/,
  /\bsame here\b/,
  /(?<!for )\bme too\b/, // but "works for me too" is a success
  /\bhappening to me too\b/,
  /\bfor me either\b/,
];

// "No problem" and "no issues" contain problem words but mean success, so
// they're taken out before the problem check.
const ALL_CLEAR = /\bno (?:problems?|issues?|trouble)\b/g;

// Phrases that signal something worked.
const SUCCESS_PATTERNS: readonly RegExp[] = [
  ALL_CLEAR,
  /\bworks?\b/,
  /\bworked\b/,
  /\bworking fine\b/,
  /\bfine\b/,
  /\bwent through\b/,
  /\bsubmitted\b/,
  /\ball good\b/,
  /\bsmooth(?:ly)?\b/,
];

export const classifyMessage = (text: string): BrainMessageKind => {
  // Curly apostrophes (’ ‘) are common in chat. Treat them like straight ones.
  const normalized = text.toLowerCase().replace(/[’‘]/g, "'");
  const withoutAllClear = normalized.replace(ALL_CLEAR, ' ');

  // Check for problems first: "doesn't work" contains "work", and it's a problem.
  if (PROBLEM_PATTERNS.some((pattern) => pattern.test(withoutAllClear))) {
    return 'problem';
  }
  // ALL_CLEAR has the g flag, so search() is used: test() would remember its
  // position between calls.
  if (SUCCESS_PATTERNS.some((pattern) => normalized.search(pattern) !== -1)) {
    return 'success';
  }
  return 'neither';
};
