import type { Progress, WordStat } from './types';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Review gaps by mastery level 1..5: a few minutes, 1, 3, 7, 14 days. */
export const INTERVALS_MS = [5 * MIN, DAY, 3 * DAY, 7 * DAY, 14 * DAY] as const;
export const MAX_MASTERY = INTERVALS_MS.length;
/** A word counts as learned after two net correct answers. */
export const LEARNED_MASTERY = 2;

export const emptyStat = (): WordStat => ({ correct: 0, wrong: 0, lastReview: null, mastery: 0, nextReview: null });

/** A miss lowers mastery by one step (never to "forgotten everything") and makes the word due at once. */
export function applyAnswer(prev: WordStat | undefined, correct: boolean, now: number): WordStat {
  const s = prev ?? emptyStat();
  if (correct) {
    const mastery = Math.min(s.mastery + 1, MAX_MASTERY);
    return { ...s, correct: s.correct + 1, lastReview: now, mastery, nextReview: now + INTERVALS_MS[mastery - 1] };
  }
  return { ...s, wrong: s.wrong + 1, lastReview: now, mastery: Math.max(s.mastery - 1, 0), nextReview: now };
}

/** Seen words whose review time has come, most overdue first. */
export function dueWordIds(progress: Progress, now: number): string[] {
  return Object.entries(progress.words)
    .filter(([, s]) => s.nextReview !== null && s.nextReview <= now)
    .sort((a, b) => (a[1].nextReview ?? 0) - (b[1].nextReview ?? 0))
    .map(([id]) => id);
}

export function learnedCount(progress: Progress): number {
  return Object.values(progress.words).filter((s) => s.mastery >= LEARNED_MASTERY).length;
}
