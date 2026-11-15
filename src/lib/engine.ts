import type { Content, Mission, PickMode, Progress, Verb, VerbForm } from './types';
import { confusionsOf, dueWordIds, hardWordIds, weakestMode } from './srs';

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
  /** read: the English word is shown and spoken; listen: spoken only; name: Ukrainian shown, pick the English word. */
  mode: PickMode;
  shot: boolean;
  retry: boolean;
}
export interface BuildStep {
  kind: 'build';
  key: string;
  sentenceId: string;
  /** Shuffled blocks; on the hard tier one of them does not belong to the sentence. */
  tokens: string[];
  /** Number of blocks in the right answer. */
  answerLength: number;
  /** translate: the Ukrainian sentence is shown; dictation: the English one is only heard. */
  prompt: 'translate' | 'dictation';
  retry: boolean;
}
/** Listening to a whole sentence: hear it in English, pick what it means. */
export interface HearStep {
  kind: 'hear';
  key: string;
  sentenceId: string;
  options: string[];
  retry: boolean;
}
export interface DialogueStep {
  kind: 'dialogue';
  key: string;
  dialogueId: string;
  /** Option indices in display order. */
  order: number[];
  retry: boolean;
}
/** Grammar rule card, shown before the exercises of a topic. Not scored. */
export interface RuleStep {
  kind: 'rule';
  key: string;
  topicId: string;
}
/** Choose the right form for the gap in a sentence. */
export interface GapStep {
  kind: 'gap';
  key: string;
  itemId: string;
  topicId: string;
  options: string[];
  retry: boolean;
}
/** Irregular verb: give the past form or the third form. */
export interface VerbStep {
  kind: 'verb';
  key: string;
  verb: string;
  form: VerbForm;
  topicId: string;
  options: string[];
  retry: boolean;
}
export type Step = IntroStep | PickStep | BuildStep | HearStep | DialogueStep | RuleStep | GapStep | VerbStep;

/** Steps that are shown but not scored. */
export const isUnscored = (s: Step): boolean => s.kind === 'intro' || s.kind === 'rule';

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

export interface Tier {
  options: number;
  /** Gap exercises and verb forms per grammar match. */
  gaps: number;
  verbForms: number;
  listen: number;
  name: number;
  /** Sentence-listening questions, taken from matches already played. */
  hear: number;
  /** Add a block that does not belong to the sentence. */
  buildDistractor: boolean;
  /** Build the last sentence by ear. */
  dictation: boolean;
}

/** Difficulty tiers. Each step adds a little; nothing is taken away from the content itself. */
export const TIERS: readonly Tier[] = [
  { options: 3, gaps: 4, verbForms: 5, listen: 3, name: 2, hear: 0, buildDistractor: false, dictation: false },
  { options: 4, gaps: 5, verbForms: 6, listen: 4, name: 3, hear: 1, buildDistractor: false, dictation: false },
  { options: 4, gaps: 6, verbForms: 8, listen: 5, name: 4, hear: 2, buildDistractor: true, dictation: true },
];

export const tierOf = (progress: Progress): Tier => TIERS[Math.min(TIERS.length - 1, Math.max(0, progress.adaptive.tier))];

export const REVIEW_ID = 'review';
export const WEAK_ID = 'weak';
const REVIEW_WORDS = 8;
const REVIEW_REWARD_XP = 15;
const HEAR_OPTIONS = 3;
/** How many of a word's known mix-ups are put among its answer options. */
const CONFUSIONS_PER_QUESTION = 2;

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

/** Block text without case and punctuation, to tell real duplicates apart. */
const bare = (token: string): string => token.toLowerCase().replace(/[^a-z']/g, '');

interface Ctx {
  content: Content;
  progress: Progress;
  tier: Tier;
  rng: Rng;
}

/**
 * Options for a word: the words the player has mixed it up with come first (so the
 * exact confusion gets practised), the rest are drawn from the pool.
 */
function makePick(key: string, wordId: string, mode: PickMode, pool: string[], ctx: Ctx, shot = false): PickStep {
  const { content, progress, tier, rng } = ctx;
  const confused = confusionsOf(progress.words[wordId])
    .filter((id) => id !== wordId && content.wordById.has(id))
    // Always leave room for at least one fresh option, so the same set never repeats forever.
    .slice(0, Math.min(CONFUSIONS_PER_QUESTION, tier.options - 2));
  const rest = shuffle(pool.filter((id) => id !== wordId && !confused.includes(id)), rng);
  const distractors = [...confused, ...rest].slice(0, tier.options - 1);
  return { kind: 'pick', key, wordId, mode, shot, retry: false, options: shuffle([wordId, ...distractors], rng) };
}

function makeBuild(key: string, sentenceId: string, ctx: Ctx, prompt: BuildStep['prompt']): BuildStep {
  const { content, tier, rng } = ctx;
  const sentence = content.sentenceById.get(sentenceId);
  if (!sentence) throw new Error(`Unknown sentence: ${sentenceId}`);
  const ordered = tokenize(sentence.english);
  let blocks = ordered;
  if (tier.buildDistractor) {
    const own = new Set(ordered.map(bare));
    const foreign = shuffle(content.sentences.flatMap((s) => tokenize(s.english)), rng).find((t) => !own.has(bare(t)));
    // Stripped of punctuation and capitals so that its shape does not give it away.
    if (foreign) blocks = [...ordered, bare(foreign)];
  }
  let tokens = shuffle(blocks, rng);
  // Never hand over the answer already assembled.
  if (tokens.slice(0, ordered.length).join(' ') === ordered.join(' ')) tokens = [...tokens.slice(1), tokens[0]];
  return { kind: 'build', key, sentenceId, tokens, answerLength: ordered.length, prompt, retry: false };
}

/** Distractor pool: the given words first, topped up from the rest of the dictionary. */
function optionPool(primary: string[], ctx: Ctx): string[] {
  const pool = uniq(primary);
  if (pool.length >= ctx.tier.options) return pool;
  const rest = shuffle(ctx.content.words.map((w) => w.id).filter((id) => !pool.includes(id)), ctx.rng);
  return [...pool, ...rest.slice(0, ctx.tier.options - pool.length)];
}

/** Sentences from matches already played, except those of `exclude`. */
function knownSentences(ctx: Ctx, exclude: string[]): string[] {
  const { content, progress } = ctx;
  return uniq(content.missions.filter((m) => progress.missions[m.id]?.completed > 0).flatMap((m) => m.sentences))
    .filter((id) => !exclude.includes(id) && content.sentenceById.has(id));
}

function makeHearSteps(ctx: Ctx, exclude: string[]): HearStep[] {
  const { content, tier, rng } = ctx;
  const known = knownSentences(ctx, exclude);
  if (tier.hear === 0 || known.length === 0) return [];
  const all = content.sentences.map((s) => s.id);
  return shuffle(known, rng).slice(0, tier.hear).map((sentenceId) => {
    const others = shuffle(uniq([...known, ...all]).filter((id) => id !== sentenceId), rng).slice(0, HEAR_OPTIONS - 1);
    return { kind: 'hear', key: `hear-${sentenceId}`, sentenceId, options: shuffle([sentenceId, ...others], rng), retry: false };
  });
}

function makeDialogue(dialogueId: string, ctx: Ctx): DialogueStep {
  const dialogue = ctx.content.dialogues.find((d) => d.id === dialogueId);
  if (!dialogue) throw new Error(`Unknown dialogue: ${dialogueId}`);
  return { kind: 'dialogue', key: `dialogue-${dialogueId}`, dialogueId, order: shuffle(dialogue.options.map((_, i) => i), ctx.rng), retry: false };
}

function withShots(missionId: string, title: string, rewardXp: number, body: Step[], shotWords: string[], pool: string[], ctx: Ctx): MatchPlan {
  const [first, second = first] = shuffle(shotWords, ctx.rng);
  const steps = [...body, makePick('shot-1', first, 'listen', pool, ctx, true)];
  return {
    missionId,
    title,
    rewardXp,
    steps,
    // Marked as a retry so a goal on the second attempt is not counted as a first-try answer.
    spareShot: { ...makePick('shot-2', second, 'listen', pool, ctx, true), retry: true },
    questionCount: steps.filter((s) => !isUnscored(s)).length,
  };
}

/** A wrong past form a learner would plausibly make: go → goed, come → comed, fly → flied. */
export function regularise(base: string): string {
  if (base.endsWith('e')) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  return `${base}ed`;
}

/** Correct form plus wrong ones that are all real-looking and all different from it. */
export function verbOptions(verb: Verb, form: VerbForm, count: number, rng: Rng): string[] {
  const correct = form === 'past' ? verb.past : verb.participle;
  const other = form === 'past' ? verb.participle : verb.past;
  const candidates = uniq([regularise(verb.base), other, verb.base, `${verb.base}s`, `${verb.base}ing`]).filter((x) => x !== correct);
  return shuffle([correct, ...candidates.slice(0, count - 1)], rng);
}

function makeGap(itemId: string, ctx: Ctx, keyPrefix = 'gap'): GapStep {
  const item = ctx.content.grammarItemById.get(itemId);
  if (!item) throw new Error(`Unknown grammar item: ${itemId}`);
  const wrong = shuffle(item.wrong, ctx.rng).slice(0, ctx.tier.options - 1);
  return { kind: 'gap', key: `${keyPrefix}-${itemId}`, itemId, topicId: item.topic, options: shuffle([item.answer, ...wrong], ctx.rng), retry: false };
}

function makeVerb(base: string, form: VerbForm, topicId: string, ctx: Ctx, keyPrefix = 'verb'): VerbStep {
  const verb = ctx.content.verbByBase.get(base);
  if (!verb) throw new Error(`Unknown verb: ${base}`);
  return { kind: 'verb', key: `${keyPrefix}-${base}-${form}`, verb: base, form, topicId, options: verbOptions(verb, form, ctx.tier.options, ctx.rng), retry: false };
}

const GRAMMAR_LISTEN = 2;

/**
 * A grammar match: the rule card (on the first visit), the match's new words, a short listening
 * round, gap exercises, verb forms, sentence building, the dialogue and the shot.
 */
function buildGrammarMatch(mission: Mission, ctx: Ctx, now: number): MatchPlan {
  const { content, progress, tier, rng } = ctx;
  const grammar = mission.grammar!;
  const pool = optionPool(mission.words, ctx);
  const body: Step[] = [];

  if (!(progress.missions[mission.id]?.completed > 0)) body.push({ kind: 'rule', key: `rule-${grammar.topic}`, topicId: grammar.topic });

  for (const id of mission.words) {
    if ((progress.words[id]?.mastery ?? 0) === 0) body.push({ kind: 'intro', key: `intro-${id}`, wordId: id });
  }
  for (const id of shuffle(mission.words, rng)) body.push(makePick(`read-${id}`, id, 'read', pool, ctx));

  const due = dueWordIds(progress, now).filter((id) => !mission.words.includes(id) && content.wordById.has(id)).slice(0, 1);
  for (const id of shuffle([...due, ...shuffle(mission.words, rng)].slice(0, GRAMMAR_LISTEN), rng)) {
    body.push(makePick(`listen-${id}`, id, 'listen', uniq([...pool, ...due]), ctx));
  }

  for (const id of shuffle(grammar.items, rng).slice(0, tier.gaps)) body.push(makeGap(id, ctx));
  if (grammar.verbs?.length && grammar.verbForm) {
    for (const v of shuffle(grammar.verbs, rng).slice(0, tier.verbForms)) body.push(makeVerb(v, grammar.verbForm, grammar.topic, ctx));
  }

  body.push(...makeHearSteps(ctx, mission.sentences));
  for (const id of mission.sentences) body.push(makeBuild(`build-${id}`, id, ctx, 'translate'));

  const dialogue = content.dialogues.find((d) => d.mission === mission.id);
  if (dialogue) body.push(makeDialogue(dialogue.id, ctx));

  return withShots(mission.id, mission.title, mission.rewards.xp, body, mission.words, pool, ctx);
}

const REVIEW_GRAMMAR = 2;

/** Grammar for a review match: mistakes first, then exercises from grammar matches already played. */
function reviewGrammarSteps(ctx: Ctx): Step[] {
  const { content, progress, rng } = ctx;
  const steps: Step[] = [];
  for (const key of [...progress.grammarMissed].reverse()) {
    if (steps.length >= REVIEW_GRAMMAR) break;
    const [kind, id, form] = key.split(':');
    if (kind === 'item' && content.grammarItemById.has(id)) steps.push(makeGap(id, ctx, 'review-gap'));
    if (kind === 'verb' && content.verbByBase.has(id) && (form === 'past' || form === 'participle')) {
      const topic = form === 'past' ? 'past-irregular' : 'present-perfect';
      steps.push(makeVerb(id, form, topic, ctx, 'review-verb'));
    }
  }
  const played = content.missions.filter((m) => m.grammar && progress.missions[m.id]?.completed > 0);
  const extra = shuffle(played.flatMap((m) => m.grammar!.items), rng).filter((id) => !steps.some((s) => s.kind === 'gap' && s.itemId === id));
  for (const id of extra.slice(0, REVIEW_GRAMMAR - steps.length)) steps.push(makeGap(id, ctx, 'review-gap'));
  return steps;
}

/** Progress key under which a grammar answer is remembered. */
export function grammarKey(step: GapStep | VerbStep): string {
  return step.kind === 'gap' ? `item:${step.itemId}` : `verb:${step.verb}:${step.form}`;
}

/**
 * A match: new words are introduced three at a time and checked straight away, then listening
 * (mixed with words due for review), naming in English, sentence listening, sentence building,
 * the mission's dialogue, and the shot. The difficulty tier sets how much of each there is.
 */
export function buildMatch(mission: Mission, content: Content, progress: Progress, now: number, rng: Rng = Math.random): MatchPlan {
  for (const id of mission.words) if (!content.wordById.has(id)) throw new Error(`Unknown word: ${id}`);
  const ctx: Ctx = { content, progress, tier: tierOf(progress), rng };
  if (mission.grammar) return buildGrammarMatch(mission, ctx, now);
  const { tier } = ctx;
  const pool = optionPool(mission.words, ctx);
  const body: Step[] = [];

  for (let i = 0; i < mission.words.length; i += 3) {
    const chunk = mission.words.slice(i, i + 3);
    for (const id of chunk) {
      if ((progress.words[id]?.mastery ?? 0) === 0) body.push({ kind: 'intro', key: `intro-${id}`, wordId: id });
    }
    for (const id of shuffle(chunk, rng)) body.push(makePick(`read-${id}`, id, 'read', pool, ctx));
  }

  const due = dueWordIds(progress, now)
    .filter((id) => !mission.words.includes(id) && content.wordById.has(id))
    .slice(0, 2);
  const listenWords = [...due, ...shuffle(mission.words, rng)].slice(0, tier.listen);
  const listenPool = uniq([...pool, ...due]);
  for (const id of shuffle(listenWords, rng)) body.push(makePick(`listen-${id}`, id, 'listen', listenPool, ctx));

  for (const id of shuffle(mission.words, rng).slice(0, tier.name)) body.push(makePick(`name-${id}`, id, 'name', pool, ctx));

  body.push(...makeHearSteps(ctx, mission.sentences));

  mission.sentences.forEach((id, i) => {
    const byEar = tier.dictation && i === mission.sentences.length - 1 && mission.sentences.length > 1;
    body.push(makeBuild(`build-${id}`, id, ctx, byEar ? 'dictation' : 'translate'));
  });

  const dialogue = content.dialogues.find((d) => d.mission === mission.id);
  if (dialogue) body.push(makeDialogue(dialogue.id, ctx));

  return withShots(mission.id, mission.title, mission.rewards.xp, body, mission.words, pool, ctx);
}

/**
 * Review match. Each word is asked in the task type it is weakest in.
 * `focus` narrows it to given words (the weak-words drill); otherwise overdue and weakest words are taken.
 */
export function buildReview(content: Content, progress: Progress, now: number, rng: Rng = Math.random, focus?: string[]): MatchPlan {
  const ctx: Ctx = { content, progress, tier: tierOf(progress), rng };
  const valid = (id: string) => content.wordById.has(id);
  const due = dueWordIds(progress, now).filter(valid);
  const weakest = Object.entries(progress.words)
    .filter(([id]) => valid(id))
    .sort((a, b) => a[1].mastery - b[1].mastery)
    .map(([id]) => id);
  const fallback = shuffle(content.words.map((w) => w.id), rng);
  const words = uniq([...(focus ?? []).filter(valid), ...due, ...weakest, ...fallback]).slice(0, REVIEW_WORDS);
  const pool = optionPool(words, ctx);

  const body: Step[] = [];
  words.forEach((id, i) => {
    const mode = weakestMode(progress.words[id], i);
    body.push(makePick(`${mode}-${id}`, id, mode, pool, ctx));
  });

  body.push(...makeHearSteps(ctx, []));
  body.push(...reviewGrammarSteps(ctx));

  const known = knownSentences(ctx, []);
  const sentences = shuffle(known.length >= 2 ? known : content.sentences.map((s) => s.id), rng).slice(0, 2);
  for (const id of sentences) body.push(makeBuild(`build-${id}`, id, ctx, 'translate'));

  const played = content.dialogues.filter((d) => progress.missions[d.mission]?.completed > 0);
  if (played.length) body.push(makeDialogue(shuffle(played, rng)[0].id, ctx));

  return focus
    ? withShots(WEAK_ID, 'Weak Words', REVIEW_REWARD_XP, body, words, pool, ctx)
    : withShots(REVIEW_ID, 'Review Match', REVIEW_REWARD_XP, body, words, pool, ctx);
}

/** Match made of the words the player keeps missing. */
export function buildWeakDrill(content: Content, progress: Progress, now: number, rng: Rng = Math.random): MatchPlan {
  return buildReview(content, progress, now, rng, hardWordIds(progress));
}

export const SPEAK_ITEMS = 5;
export const SPEAK_MIN_WORDS = 3;

/** Words for the pronunciation drill: overdue and difficult ones first, then anything already met. */
export function pickSpeakWords(content: Content, progress: Progress, now: number, rng: Rng = Math.random): string[] {
  const seen = Object.keys(progress.words).filter((id) => content.wordById.has(id));
  if (seen.length < SPEAK_MIN_WORDS) return [];
  const priority = uniq([...dueWordIds(progress, now), ...hardWordIds(progress)]).filter((id) => seen.includes(id));
  return uniq([...priority, ...shuffle(seen, rng)]).slice(0, SPEAK_ITEMS);
}
