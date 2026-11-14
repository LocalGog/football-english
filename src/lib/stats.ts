import type { Content, DayStat, PickMode, Progress } from './types';
import { emptyDay, localDay } from './progress';
import { confusionsOf, hardWordIds, LEARNED_MASTERY, weakestMode } from './srs';

/** Local dates of the last `n` days, oldest first, ending today. Built from calendar fields, so DST is harmless. */
export function lastDays(n: number, now: number): string[] {
  const today = new Date(now);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i), 12);
    return localDay(d.getTime());
  });
}

export function sumDays(p: Progress, days: string[]): DayStat {
  const total = emptyDay();
  for (const day of days) {
    const d = p.history[day];
    if (!d) continue;
    for (const k of Object.keys(total) as (keyof DayStat)[]) total[k] += d[k];
  }
  return total;
}

export const minutesOf = (seconds: number): number => Math.round(seconds / 60);

export function todayMinutes(p: Progress, now: number): number {
  return minutesOf(p.history[localDay(now)]?.seconds ?? 0);
}

export interface Period {
  days: number;
  activeDays: number;
  minutes: number;
  matches: number;
  learned: number;
  /** Share of right answers, or null when there were none. */
  accuracy: number | null;
  listenAccuracy: number | null;
  listenAnswers: number;
}

export function periodSummary(p: Progress, days: number, now: number): Period {
  const keys = lastDays(days, now);
  const s = sumDays(p, keys);
  return {
    days,
    activeDays: keys.filter((k) => (p.history[k]?.answers ?? 0) > 0 || (p.history[k]?.seconds ?? 0) > 0).length,
    minutes: minutesOf(s.seconds),
    matches: s.matches,
    learned: s.learned,
    accuracy: s.answers ? s.correct / s.answers : null,
    listenAccuracy: s.listenAnswers ? s.listenCorrect / s.listenAnswers : null,
    listenAnswers: s.listenAnswers,
  };
}

export interface ModeAccuracy {
  mode: PickMode;
  answers: number;
  accuracy: number | null;
}

/** All-time accuracy by task type: reading the word, hearing it, recalling it in English. */
export function accuracyByMode(p: Progress): ModeAccuracy[] {
  return (['read', 'listen', 'name'] as const).map((mode) => {
    let c = 0;
    let w = 0;
    for (const s of Object.values(p.words)) {
      c += s.modes?.[mode]?.c ?? 0;
      w += s.modes?.[mode]?.w ?? 0;
    }
    return { mode, answers: c + w, accuracy: c + w ? c / (c + w) : null };
  });
}

export interface Topic {
  id: string;
  title: string;
  total: number;
  seen: number;
  learned: number;
}

/** A topic counts as mastered once this share of its words is learned. */
export const TOPIC_MASTERED = 0.8;

/** Topics in the order they are taught. */
export function topics(content: Content, p: Progress): Topic[] {
  const order: string[] = [];
  for (const m of content.missions) {
    for (const id of m.words) {
      const cat = content.wordById.get(id)?.category;
      if (cat && !order.includes(cat)) order.push(cat);
    }
  }
  return order.map((id) => {
    const words = content.words.filter((w) => w.category === id);
    return {
      id,
      title: content.categories[id] ?? id,
      total: words.length,
      seen: words.filter((w) => w.id in p.words).length,
      learned: words.filter((w) => (p.words[w.id]?.mastery ?? 0) >= LEARNED_MASTERY).length,
    };
  });
}

export const isMastered = (t: Topic): boolean => t.total > 0 && t.learned / t.total >= TOPIC_MASTERED;

export interface HardWord {
  id: string;
  wrong: number;
  correct: number;
  weakMode: PickMode;
  confusedWith: string[];
}

export function hardWords(content: Content, p: Progress): HardWord[] {
  return hardWordIds(p)
    .filter((id) => content.wordById.has(id))
    .map((id) => {
      const s = p.words[id];
      return {
        id,
        wrong: s.wrong,
        correct: s.correct,
        weakMode: weakestMode(s),
        confusedWith: confusionsOf(s).filter((x) => content.wordById.has(x)).slice(0, 2),
      };
    });
}
