import type { PickMode, Progress, WordStat } from './types';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Review gaps by mastery level 1..5: a few minutes, 1, 3, 7, 14 days. */
export const INTERVALS_MS = [5 * MIN, DAY, 3 * DAY, 7 * DAY, 14 * DAY] as const;
export const MAX_MASTERY = INTERVALS_MS.length;
/** A word counts as learned after two net correct answers. */
export const LEARNED_MASTERY = 2;

export const emptyStat = (): WordStat => ({ correct: 0, wrong: 0, lastReview: null, mastery: 0, nextReview: null });

/** A miss lowers mastery by one step (never to "forgotten everything") and makes the word due at once. */
export function applyAnswer(
  prev: WordStat | undefined, correct: boolean, now: number, mode?: PickMode, chosen?: string,
): WordStat {
  const s = prev ?? emptyStat();
  const next: WordStat = { ...s, lastReview: now };
  if (mode) {
    const tally = s.modes?.[mode] ?? { c: 0, w: 0 };
    next.modes = { ...s.modes, [mode]: correct ? { ...tally, c: tally.c + 1 } : { ...tally, w: tally.w + 1 } };
  }
  if (correct) {
    next.correct = s.correct + 1;
    next.mastery = Math.min(s.mastery + 1, MAX_MASTERY);
    next.nextReview = now + INTERVALS_MS[next.mastery - 1];
    return next;
  }
  next.wrong = s.wrong + 1;
  next.mastery = Math.max(s.mastery - 1, 0);
  next.nextReview = now;
  if (chosen) {
    const confused = { ...s.confused, [chosen]: (s.confused?.[chosen] ?? 0) + 1 };
    // Only the strongest few mix-ups are worth keeping.
    next.confused = Object.fromEntries(Object.entries(confused).sort((a, b) => b[1] - a[1]).slice(0, MAX_CONFUSED));
  }
  return next;
}

const MAX_CONFUSED = 4;
const MODES: PickMode[] = ['read', 'listen', 'name'];

/** Task type this word is answered worst in; untried types count as weak. `rotate` breaks ties evenly. */
export function weakestMode(stat: WordStat | undefined, rotate = 0): PickMode {
  const score = (m: PickMode) => {
    const t = stat?.modes?.[m];
    return t ? (t.c + 1) / (t.c + t.w + 2) : 0.5;
  };
  const order = MODES.map((_, i) => MODES[(i + rotate) % MODES.length]);
  return order.reduce((worst, m) => (score(m) < score(worst) ? m : worst));
}

/** Words the player keeps getting wrong: at least two misses and not yet solid. Worst first. */
export function hardWordIds(progress: Progress): string[] {
  return Object.entries(progress.words)
    .filter(([, s]) => s.wrong >= 2 && s.mastery < HARD_UNTIL_MASTERY)
    .sort((a, b) => b[1].wrong - b[1].correct - (a[1].wrong - a[1].correct))
    .map(([id]) => id);
}

const HARD_UNTIL_MASTERY = 3;

/** What each word is mixed up with, strongest first. */
export function confusionsOf(stat: WordStat | undefined): string[] {
  return Object.entries(stat?.confused ?? {}).sort((a, b) => b[1] - a[1]).map(([id]) => id);
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
