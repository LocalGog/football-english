import { describe, expect, it } from 'vitest';
import { content } from '../src/lib/content';
import { buildMatch, buildReview, buildWeakDrill, pickSpeakWords, TIERS, WEAK_ID, type MatchPlan, type Rng } from '../src/lib/engine';
import { newProgress, nextTier, normalizeProgress, recordAnswer, recordMatch, recordSpeakDrill, XP_SPEAK_DRILL } from '../src/lib/progress';
import { applyAnswer, confusionsOf, hardWordIds, weakestMode } from '../src/lib/srs';
import type { MatchResult, Progress } from '../src/lib/types';

function seeded(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const atTier = (tier: number, p: Progress = newProgress()): Progress => ({ ...p, adaptive: { tier } });
const result = (correct: number, total: number): MatchResult => ({ missionId: 'm01', correct, total, goal: true, xp: 10, seconds: 10, missed: [] });
const played = (p: Progress, ids: string[]): Progress => ids.reduce((acc, id) => recordMatch(acc, { ...result(5, 10), missionId: id }, 0, true), p);
const count = (plan: MatchPlan, pred: (s: MatchPlan['steps'][number]) => boolean) => plan.steps.filter(pred).length;
const m = (id: string) => content.missions.find((x) => x.id === id)!;

describe('error analysis', () => {
  it('tallies answers per task type and remembers what a word was mixed up with', () => {
    let s = applyAnswer(undefined, true, 0, 'read');
    s = applyAnswer(s, false, 0, 'listen', 'goal');
    s = applyAnswer(s, false, 0, 'listen', 'goal');
    s = applyAnswer(s, false, 0, 'name', 'team');
    expect(s.modes).toEqual({ read: { c: 1, w: 0 }, listen: { c: 0, w: 2 }, name: { c: 0, w: 1 } });
    expect(confusionsOf(s)).toEqual(['goal', 'team']);
    expect(weakestMode(s)).toBe('listen');
  });
  it('keeps only the strongest mix-ups', () => {
    let s = applyAnswer(undefined, false, 0, 'read', 'a');
    for (const other of ['a', 'b', 'c', 'd', 'e']) s = applyAnswer(s, false, 0, 'read', other);
    expect(Object.keys(s.confused!).length).toBe(4);
    expect(confusionsOf(s)[0]).toBe('a');
  });
  it('spreads untried task types evenly', () => {
    expect([0, 1, 2].map((i) => weakestMode(undefined, i))).toEqual(['read', 'listen', 'name']);
  });
  it('lists hard words: two or more misses and not yet solid, worst first', () => {
    let p = newProgress();
    p = recordAnswer(recordAnswer(p, 'ball', false, 0), 'ball', false, 0);
    p = recordAnswer(recordAnswer(recordAnswer(p, 'goal', false, 0), 'goal', false, 0), 'goal', false, 0);
    p = recordAnswer(p, 'team', false, 0);
    expect(hardWordIds(p)).toEqual(['goal', 'ball']);
    for (let i = 0; i < 4; i++) p = recordAnswer(p, 'goal', true, 0);
    expect(hardWordIds(p)).toEqual(['ball']);
  });
  it('puts the words a player mixes up among the options', () => {
    let p = recordAnswer(atTier(1), 'ball', false, 0, 'read', 'stadium');
    p = recordAnswer(p, 'ball', false, 0, 'read', 'medal');
    for (let seed = 1; seed <= 10; seed++) {
      const plan = buildMatch(m('m01'), content, p, 0, seeded(seed));
      for (const s of plan.steps) {
        if (s.kind === 'pick' && s.wordId === 'ball') expect(s.options).toEqual(expect.arrayContaining(['stadium', 'medal']));
      }
      // The gentlest tier has three options: one mix-up and one fresh word.
      for (const s of buildMatch(m('m01'), content, atTier(0, p), 0, seeded(seed)).steps) {
        if (s.kind === 'pick' && s.wordId === 'ball') expect(s.options.filter((o) => o === 'stadium' || o === 'medal').length).toBe(1);
      }
    }
  });
  it('survives a save and load', () => {
    const p = recordAnswer(newProgress(), 'ball', false, 0, 'listen', 'goal');
    const back = normalizeProgress(JSON.parse(JSON.stringify(p)));
    expect(back?.words.ball).toEqual(p.words.ball);
    const junk = normalizeProgress({ version: 1, words: { ball: { modes: { listen: { c: 'x', w: -2 }, bogus: {} }, confused: { goal: 'many', team: 2 } } } });
    expect(junk?.words.ball.modes).toEqual({ listen: { c: 0, w: 0 } });
    expect(junk?.words.ball.confused).toEqual({ team: 2 });
  });
});

describe('adaptive difficulty', () => {
  it('moves one step at a time and stays within bounds', () => {
    expect(nextTier(0, 9, 10)).toBe(1);
    expect(nextTier(1, 10, 10)).toBe(2);
    expect(nextTier(2, 10, 10)).toBe(2);
    expect(nextTier(1, 8, 10)).toBe(1);
    expect(nextTier(1, 5, 10)).toBe(0);
    expect(nextTier(0, 0, 10)).toBe(0);
    expect(nextTier(1, 0, 0)).toBe(1);
  });
  it('new players start gentle; a match result moves the tier; old saves keep the level they had', () => {
    expect(newProgress().adaptive.tier).toBe(0);
    expect(recordMatch(newProgress(), result(14, 14), 0, true).adaptive.tier).toBe(1);
    expect(recordMatch(atTier(2), result(5, 14), 0, true).adaptive.tier).toBe(1);
    expect(normalizeProgress({ version: 1 })?.adaptive.tier).toBe(1);
    expect(normalizeProgress({ version: 1, adaptive: { tier: 99 } })?.adaptive.tier).toBe(2);
  });
  it('each tier asks for more', () => {
    const base = played(newProgress(), ['m01', 'm02']);
    const sizes = TIERS.map((_, tier) => buildMatch(m('m03'), content, atTier(tier, base), 0, seeded(4)).questionCount);
    expect(sizes[0]).toBeLessThan(sizes[1]);
    expect(sizes[1]).toBeLessThan(sizes[2]);
  });
  it('hard tier adds an extra block and one sentence by ear; lower tiers do not', () => {
    const builds = (tier: number) => buildMatch(m('m02'), content, atTier(tier), 0, seeded(7)).steps.flatMap((s) => (s.kind === 'build' ? [s] : []));
    expect(builds(1).map((b) => [b.prompt, b.tokens.length - b.answerLength])).toEqual([['translate', 0], ['translate', 0]]);
    expect(builds(2).map((b) => [b.prompt, b.tokens.length - b.answerLength])).toEqual([['translate', 1], ['dictation', 1]]);
  });
});

describe('listening to sentences and dialogues', () => {
  it('sentence listening uses only sentences from matches already played', () => {
    const fresh = buildMatch(m('m03'), content, atTier(2), 0, seeded(1));
    expect(count(fresh, (s) => s.kind === 'hear')).toBe(0);
    const p = atTier(2, played(newProgress(), ['m01', 'm02']));
    const known = new Set([...m('m01').sentences, ...m('m02').sentences]);
    for (let seed = 1; seed <= 10; seed++) {
      const plan = buildMatch(m('m03'), content, p, 0, seeded(seed));
      const hears = plan.steps.flatMap((s) => (s.kind === 'hear' ? [s] : []));
      expect(hears.length).toBe(2);
      for (const h of hears) expect(known.has(h.sentenceId)).toBe(true);
    }
    expect(count(buildMatch(m('m03'), content, atTier(0, p), 0, seeded(1)), (s) => s.kind === 'hear')).toBe(0);
  });
  it('a mission with a dialogue ends with it, just before the shot', () => {
    const plan = buildMatch(m('m02'), content, newProgress(), 0, seeded(1));
    const beforeShot = plan.steps[plan.steps.length - 2];
    expect(beforeShot).toMatchObject({ kind: 'dialogue', dialogueId: 'd01' });
    expect(count(buildMatch(m('m01'), content, newProgress(), 0, seeded(1)), (s) => s.kind === 'dialogue')).toBe(0);
  });
  it('a review match replays a dialogue from a played mission', () => {
    expect(count(buildReview(content, newProgress(), 0, seeded(1)), (s) => s.kind === 'dialogue')).toBe(0);
    const plan = buildReview(content, played(newProgress(), ['m02']), 0, seeded(1));
    expect(plan.steps.find((s) => s.kind === 'dialogue')).toMatchObject({ dialogueId: 'd01' });
  });
  it('dialogue replies are written so that the first option is not always right on screen', () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const step = buildMatch(m('m02'), content, newProgress(), 0, seeded(seed)).steps.find((s) => s.kind === 'dialogue');
      if (step?.kind === 'dialogue') firsts.add(step.order[0]);
    }
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe('drills', () => {
  it('the weak-words match is built around the hard words, each in its weakest task type', () => {
    let p = newProgress();
    for (const id of ['ball', 'goal', 'team']) {
      p = recordAnswer(recordAnswer(p, id, false, 0, 'listen', 'run'), id, false, 0, 'listen', 'run');
      p = recordAnswer(p, id, true, 0, 'read');
    }
    const plan = buildWeakDrill(content, p, 0, seeded(2));
    expect(plan.missionId).toBe(WEAK_ID);
    for (const id of ['ball', 'goal', 'team']) {
      expect(plan.steps.find((s) => s.kind === 'pick' && !s.shot && s.wordId === id)).toMatchObject({ mode: 'listen' });
    }
  });
  it('pronunciation drill needs a few known words, puts difficult ones first, and never repeats a word', () => {
    expect(pickSpeakWords(content, recordAnswer(newProgress(), 'ball', true, 0), 0, seeded(1))).toEqual([]);
    let p = newProgress();
    for (const w of content.words.slice(0, 12)) p = recordAnswer(p, w.id, true, 0);
    p = recordAnswer(recordAnswer(p, 'kick', false, 0), 'kick', false, 0);
    const words = pickSpeakWords(content, p, 0, seeded(1));
    expect(words.length).toBe(5);
    expect(new Set(words).size).toBe(5);
    expect(words[0]).toBe('kick');
  });
  it('a finished pronunciation drill adds XP and counts the words', () => {
    const p = recordSpeakDrill(newProgress(), 5);
    expect(p.xp).toBe(XP_SPEAK_DRILL);
    expect(p.stats.spoken).toBe(5);
  });
});
