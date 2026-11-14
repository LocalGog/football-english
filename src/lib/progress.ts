import type { Accent, Content, MatchResult, Mission, Progress, WordStat } from './types';
import { applyAnswer, LEARNED_MASTERY } from './srs';

export const XP_PER_LEVEL = 150;
export const XP_FIRST_TRY = 10;
export const XP_RETRY = 5;
export const XP_GOAL = 30;

const STATUSES = ['Новачок', 'Гравець двору', 'Гравець академії', 'Запасний', 'Гравець основи', 'Лідер команди', 'Капітан', 'Зірка клубу'];

export function newProgress(): Progress {
  return {
    version: 1,
    player: null,
    xp: 0,
    missions: {},
    words: {},
    settings: { accent: 'en-GB', rate: 0.9 },
    stats: { secondsPlayed: 0 },
  };
}

export function levelInfo(xp: number): { level: number; into: number; need: number; status: string } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return {
    level,
    into: xp % XP_PER_LEVEL,
    need: XP_PER_LEVEL,
    status: STATUSES[Math.min(level, STATUSES.length) - 1],
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Turns whatever came out of storage into a safe Progress, or null if it is not ours. */
export function normalizeProgress(raw: unknown): Progress | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const base = newProgress();

  if (isObj(raw.player) && typeof raw.player.name === 'string' && typeof raw.player.avatar === 'string') {
    const name = raw.player.name.trim().slice(0, 16);
    if (name) base.player = { name, avatar: raw.player.avatar };
  }
  base.xp = Math.max(0, Math.floor(num(raw.xp, 0)));

  if (isObj(raw.missions)) {
    for (const [id, m] of Object.entries(raw.missions)) {
      if (!isObj(m)) continue;
      base.missions[id] = { completed: num(m.completed, 0), goals: num(m.goals, 0), bestCorrect: num(m.bestCorrect, 0) };
    }
  }
  if (isObj(raw.words)) {
    for (const [id, w] of Object.entries(raw.words)) {
      if (!isObj(w)) continue;
      const stat: WordStat = {
        correct: num(w.correct, 0),
        wrong: num(w.wrong, 0),
        lastReview: numOrNull(w.lastReview),
        mastery: Math.min(5, Math.max(0, Math.floor(num(w.mastery, 0)))),
        nextReview: numOrNull(w.nextReview),
      };
      base.words[id] = stat;
    }
  }
  if (isObj(raw.settings)) {
    const accent: Accent = raw.settings.accent === 'en-US' ? 'en-US' : 'en-GB';
    base.settings = { accent, rate: Math.min(1.1, Math.max(0.5, num(raw.settings.rate, 0.9))) };
  }
  if (isObj(raw.stats)) base.stats.secondsPlayed = Math.max(0, num(raw.stats.secondsPlayed, 0));
  return base;
}

export function recordAnswer(p: Progress, wordId: string, correct: boolean, now: number): Progress {
  return { ...p, words: { ...p.words, [wordId]: applyAnswer(p.words[wordId], correct, now) } };
}

export function recordMatch(p: Progress, r: MatchResult): Progress {
  const prev = p.missions[r.missionId] ?? { completed: 0, goals: 0, bestCorrect: 0 };
  return {
    ...p,
    xp: p.xp + r.xp,
    missions: {
      ...p.missions,
      [r.missionId]: {
        completed: prev.completed + 1,
        goals: prev.goals + (r.goal ? 1 : 0),
        bestCorrect: Math.max(prev.bestCorrect, r.correct),
      },
    },
    stats: { secondsPlayed: p.stats.secondsPlayed + r.seconds },
  };
}

/** First mission not yet finished, or null when the whole season is done. */
export function nextMission(missions: Mission[], p: Progress): Mission | null {
  return missions.find((m) => !(p.missions[m.id]?.completed > 0)) ?? null;
}

/** Share of the earlier seasons' words that must be learned before a new season opens. */
export const LEVEL_GATE = 0.6;

export type PlayTarget =
  | { kind: 'mission'; mission: Mission }
  /** The next season is closed until more of the earlier words are learned. */
  | { kind: 'review'; reason: 'gate'; level: number; missing: number }
  | { kind: 'review'; reason: 'done' };

/**
 * What PLAY NOW starts. Seasons open by knowledge, not by matches played:
 * finishing a season is not enough if too few of its words have stuck.
 */
export function playTarget(content: Content, p: Progress): PlayTarget {
  const mission = nextMission(content.missions, p);
  if (!mission) return { kind: 'review', reason: 'done' };
  const earlier = new Set(content.missions.filter((m) => m.level < mission.level).flatMap((m) => m.words));
  if (earlier.size === 0) return { kind: 'mission', mission };
  const learned = [...earlier].filter((id) => (p.words[id]?.mastery ?? 0) >= LEARNED_MASTERY).length;
  const missing = Math.ceil(earlier.size * LEVEL_GATE) - learned;
  return missing > 0 ? { kind: 'review', reason: 'gate', level: mission.level, missing } : { kind: 'mission', mission };
}

export function goalsTotal(p: Progress): number {
  return Object.values(p.missions).reduce((sum, m) => sum + m.goals, 0);
}
