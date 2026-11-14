import type { Accent, Content, MatchResult, Mission, PickMode, Progress, WordStat } from './types';
import { applyAnswer, LEARNED_MASTERY } from './srs';

export const XP_PER_LEVEL = 150;
export const XP_FIRST_TRY = 10;
export const XP_RETRY = 5;
export const XP_GOAL = 30;
export const XP_SPEAK_DRILL = 10;

/** New players start on the gentlest tier. */
export const START_TIER = 0;
export const MAX_TIER = 2;
/** Saves from before tiers existed were made on what is now the middle tier. */
const LEGACY_TIER = 1;
const STEP_UP_ACCURACY = 0.9;
const STEP_DOWN_ACCURACY = 0.6;

/** Difficulty moves at most one step per match, so it never jumps. */
export function nextTier(tier: number, correct: number, total: number): number {
  if (total <= 0) return tier;
  const accuracy = correct / total;
  if (accuracy >= STEP_UP_ACCURACY) return Math.min(MAX_TIER, tier + 1);
  if (accuracy < STEP_DOWN_ACCURACY) return Math.max(0, tier - 1);
  return tier;
}

const STATUSES = ['Новачок', 'Гравець двору', 'Гравець академії', 'Запасний', 'Гравець основи', 'Лідер команди', 'Капітан', 'Зірка клубу'];

export function newProgress(): Progress {
  return {
    version: 1,
    player: null,
    xp: 0,
    missions: {},
    words: {},
    settings: { accent: 'en-GB', rate: 0.9 },
    stats: { secondsPlayed: 0, perfectMatches: 0, listenCorrect: 0, spoken: 0, days: [] },
    club: { cards: [], tokens: 0, ball: 'classic', stadium: 'street' },
    achievements: {},
    adaptive: { tier: START_TIER },
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
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const MAX_DAYS = 400;
export const MAX_TOKENS = 99;
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
      if (isObj(w.modes)) {
        stat.modes = {};
        for (const mode of ['read', 'listen', 'name'] as const) {
          const t = w.modes[mode];
          if (isObj(t)) stat.modes[mode] = { c: Math.max(0, num(t.c, 0)), w: Math.max(0, num(t.w, 0)) };
        }
      }
      if (isObj(w.confused)) {
        stat.confused = {};
        for (const [other, n] of Object.entries(w.confused).slice(0, 8)) {
          if (typeof n === 'number' && Number.isFinite(n) && n > 0) stat.confused[other] = n;
        }
      }
      base.words[id] = stat;
    }
  }
  if (isObj(raw.settings)) {
    const accent: Accent = raw.settings.accent === 'en-US' ? 'en-US' : 'en-GB';
    base.settings = { accent, rate: Math.min(1.1, Math.max(0.5, num(raw.settings.rate, 0.9))) };
  }
  if (isObj(raw.stats)) {
    base.stats = {
      secondsPlayed: Math.max(0, num(raw.stats.secondsPlayed, 0)),
      perfectMatches: Math.max(0, Math.floor(num(raw.stats.perfectMatches, 0))),
      listenCorrect: Math.max(0, Math.floor(num(raw.stats.listenCorrect, 0))),
      spoken: Math.max(0, Math.floor(num(raw.stats.spoken, 0))),
      days: strings(raw.stats.days).slice(-MAX_DAYS),
    };
  }
  // Saves made before the club existed simply get an empty club.
  if (isObj(raw.club)) {
    base.club = {
      cards: [...new Set(strings(raw.club.cards))],
      tokens: Math.min(MAX_TOKENS, Math.max(0, Math.floor(num(raw.club.tokens, 0)))),
      ball: typeof raw.club.ball === 'string' ? raw.club.ball : base.club.ball,
      stadium: typeof raw.club.stadium === 'string' ? raw.club.stadium : base.club.stadium,
    };
  }
  base.adaptive = {
    tier: isObj(raw.adaptive) ? Math.min(MAX_TIER, Math.max(0, Math.floor(num(raw.adaptive.tier, LEGACY_TIER)))) : LEGACY_TIER,
  };
  if (isObj(raw.achievements)) {
    for (const [id, at] of Object.entries(raw.achievements)) {
      if (typeof at === 'number' && Number.isFinite(at)) base.achievements[id] = at;
    }
  }
  return base;
}

export function recordAnswer(p: Progress, wordId: string, correct: boolean, now: number, mode?: PickMode, chosen?: string): Progress {
  const heard = correct && mode === 'listen';
  return {
    ...p,
    words: { ...p.words, [wordId]: applyAnswer(p.words[wordId], correct, now, mode, chosen) },
    stats: heard ? { ...p.stats, listenCorrect: p.stats.listenCorrect + 1 } : p.stats,
  };
}

/** Local calendar date, so "a different day" means the player's day, not UTC. */
export function localDay(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * @param transfersLeft whether there is still someone to sign: a goal then earns a transfer.
 */
export function recordMatch(p: Progress, r: MatchResult, now: number, transfersLeft: boolean): Progress {
  const prev = p.missions[r.missionId] ?? { completed: 0, goals: 0, bestCorrect: 0 };
  const day = localDay(now);
  const perfect = r.goal && r.correct === r.total;
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
    stats: {
      ...p.stats,
      secondsPlayed: p.stats.secondsPlayed + r.seconds,
      perfectMatches: p.stats.perfectMatches + (perfect ? 1 : 0),
      days: p.stats.days.includes(day) ? p.stats.days : [...p.stats.days, day].slice(-MAX_DAYS),
    },
    club: r.goal && transfersLeft ? { ...p.club, tokens: Math.min(MAX_TOKENS, p.club.tokens + 1) } : p.club,
    adaptive: { tier: nextTier(p.adaptive.tier, r.correct, r.total) },
  };
}

/** A finished pronunciation drill: the words count towards review, the drill earns a little XP. */
export function recordSpeakDrill(p: Progress, words: number): Progress {
  return { ...p, xp: p.xp + XP_SPEAK_DRILL, stats: { ...p.stats, spoken: p.stats.spoken + words } };
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
