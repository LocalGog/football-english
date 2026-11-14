import type { Content, Mission, Progress } from './types';
import { dueWordIds } from './srs';

export type Rng = () => number;

export interface IntroStep {
  kind: 'intro';
  key: string;
  wordId: string;
}
export interface PickStep {
  kind: 'pick';
  key: string;
  wordId: string;
  options: string[];
  /** read: the English word is shown and spoken; listen: spoken only. */
  mode: 'read' | 'listen';
  shot: boolean;
  retry: boolean;
}
export interface BuildStep {
  kind: 'build';
  key: string;
  sentenceId: string;
  tokens: string[];
  retry: boolean;
}
export type Step = IntroStep | PickStep | BuildStep;

export interface MatchPlan {
  missionId: string;
  title: string;
  steps: Step[];
  /** Second attempt at goal if the first shot is saved. */
  spareShot: PickStep;
  /** Number of scored questions (intros excluded). */
  questionCount: number;
  /** XP for finishing the match, on top of per-answer XP. */
  rewardXp: number;
}

export const REVIEW_ID = 'review';
const OPTION_COUNT = 4;
const LISTEN_COUNT = 4;
const REVIEW_WORDS = 8;
const REVIEW_REWARD_XP = 15;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const r = [...items];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const uniq = <T,>(items: T[]): T[] => [...new Set(items)];

export function tokenize(english: string): string[] {
  return english.trim().split(/\s+/);
}

function makePick(
  key: string, wordId: string, mode: PickStep['mode'], pool: string[], rng: Rng, shot = false,
): PickStep {
  const distractors = shuffle(pool.filter((id) => id !== wordId), rng).slice(0, OPTION_COUNT - 1);
  return { kind: 'pick', key, wordId, mode, shot, retry: false, options: shuffle([wordId, ...distractors], rng) };
}

function makeBuild(key: string, sentenceId: string, content: Content, rng: Rng): BuildStep {
  const sentence = content.sentenceById.get(sentenceId);
  if (!sentence) throw new Error(`Unknown sentence: ${sentenceId}`);
  const ordered = tokenize(sentence.english);
  let tokens = shuffle(ordered, rng);
  // Never hand over the answer already assembled.
  if (tokens.join(' ') === ordered.join(' ')) tokens = [...ordered.slice(1), ordered[0]];
  return { kind: 'build', key, sentenceId, tokens, retry: false };
}

/** Distractor pool: the mission's own words first, topped up from the rest of the dictionary. */
function optionPool(primary: string[], content: Content, rng: Rng): string[] {
  const pool = uniq(primary);
  if (pool.length >= OPTION_COUNT) return pool;
  const rest = shuffle(content.words.map((w) => w.id).filter((id) => !pool.includes(id)), rng);
  return [...pool, ...rest.slice(0, OPTION_COUNT - pool.length)];
}

function withShots(
  missionId: string, title: string, rewardXp: number, body: Step[], shotWords: string[], pool: string[], rng: Rng,
): MatchPlan {
  const [first, second = first] = shuffle(shotWords, rng);
  const steps = [...body, makePick('shot-1', first, 'listen', pool, rng, true)];
  return {
    missionId,
    title,
    rewardXp,
    steps,
    // Marked as a retry so a goal on the second attempt is not counted as a first-try answer.
    spareShot: { ...makePick('shot-2', second, 'listen', pool, rng, true), retry: true },
    questionCount: steps.filter((s) => s.kind !== 'intro').length,
  };
}

/**
 * A match: new words are introduced three at a time and checked straight away,
 * then a listening round (mixed with words due for review), sentence building, and the shot.
 */
export function buildMatch(mission: Mission, content: Content, progress: Progress, now: number, rng: Rng = Math.random): MatchPlan {
  for (const id of mission.words) if (!content.wordById.has(id)) throw new Error(`Unknown word: ${id}`);
  const pool = optionPool(mission.words, content, rng);
  const body: Step[] = [];

  for (let i = 0; i < mission.words.length; i += 3) {
    const chunk = mission.words.slice(i, i + 3);
    for (const id of chunk) {
      if ((progress.words[id]?.mastery ?? 0) === 0) body.push({ kind: 'intro', key: `intro-${id}`, wordId: id });
    }
    for (const id of shuffle(chunk, rng)) body.push(makePick(`read-${id}`, id, 'read', pool, rng));
  }

  const due = dueWordIds(progress, now)
    .filter((id) => !mission.words.includes(id) && content.wordById.has(id))
    .slice(0, 2);
  const listenWords = [...due, ...shuffle(mission.words, rng)].slice(0, LISTEN_COUNT);
  const listenPool = uniq([...pool, ...due]);
  for (const id of shuffle(listenWords, rng)) body.push(makePick(`listen-${id}`, id, 'listen', listenPool, rng));

  for (const id of mission.sentences) body.push(makeBuild(`build-${id}`, id, content, rng));

  return withShots(mission.id, mission.title, mission.rewards.xp, body, mission.words, pool, rng);
}

/** Free-play match once the season is finished: weakest and most overdue words first. */
export function buildReview(content: Content, progress: Progress, now: number, rng: Rng = Math.random): MatchPlan {
  const due = dueWordIds(progress, now).filter((id) => content.wordById.has(id));
  const weakest = Object.entries(progress.words)
    .filter(([id]) => content.wordById.has(id))
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .map(([id]) => id);
  const fallback = shuffle(content.words.map((w) => w.id), rng);
  const words = uniq([...due, ...weakest, ...fallback]).slice(0, REVIEW_WORDS);
  const pool = optionPool(words, content, rng);

  const body: Step[] = [];
  const half = Math.ceil(words.length / 2);
  words.slice(0, half).forEach((id) => body.push(makePick(`read-${id}`, id, 'read', pool, rng)));
  words.slice(half).forEach((id) => body.push(makePick(`listen-${id}`, id, 'listen', pool, rng)));
  for (const s of shuffle(content.sentences, rng).slice(0, 2)) body.push(makeBuild(`build-${s.id}`, s.id, content, rng));

  return withShots(REVIEW_ID, 'Review Match', REVIEW_REWARD_XP, body, words, pool, rng);
}
