import { describe, expect, it } from 'vitest';
import { content } from '../src/lib/content';
import { buildMatch, buildReview, grammarKey, regularise, TIERS, verbOptions, type GapStep, type MatchPlan, type Rng, type VerbStep } from '../src/lib/engine';
import { newProgress, normalizeProgress, recordGrammar, recordMatch } from '../src/lib/progress';
import { weeklyReport } from '../src/lib/report';
import { grammarStats, weakestGrammar } from '../src/lib/stats';
import type { MatchResult, Progress } from '../src/lib/types';

function seeded(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const m = (id: string) => content.missions.find((x) => x.id === id)!;
const atTier = (tier: number, p: Progress = newProgress()): Progress => ({ ...p, adaptive: { tier } });
const done = (p: Progress, id: string): Progress =>
  recordMatch(p, { missionId: id, correct: 1, total: 1, goal: true, xp: 1, seconds: 1, missed: [] } as MatchResult, 0, true);
const gaps = (plan: MatchPlan) => plan.steps.flatMap((s) => (s.kind === 'gap' ? [s] : []));
const verbs = (plan: MatchPlan) => plan.steps.flatMap((s) => (s.kind === 'verb' ? [s] : []));
const grammarMissions = content.missions.filter((x) => x.grammar);

describe('grammar content', () => {
  it('has four new seasons with every planned tense', () => {
    expect(content.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const topics = new Set(grammarMissions.map((x) => x.grammar!.topic));
    for (const t of ['present-simple', 'present-continuous', 'past-irregular', 'past-questions', 'future-will', 'going-to', 'present-perfect']) {
      expect(topics.has(t)).toBe(true);
    }
    expect(grammarMissions.every((x) => x.level >= 4)).toBe(true);
  });
  it('drills every irregular verb of the list in some match', () => {
    const drilled = new Set(grammarMissions.flatMap((x) => x.grammar!.verbs ?? []));
    expect(content.verbs.filter((v) => !drilled.has(v.base)).map((v) => v.base)).toEqual([]);
    expect(content.verbs.length).toBeGreaterThanOrEqual(40);
  });
  it('every grammar item is used by some match and the gap answer completes the translation', () => {
    const used = new Set(grammarMissions.flatMap((x) => x.grammar!.items));
    expect(content.grammarItems.filter((i) => !used.has(i.id)).map((i) => i.id)).toEqual([]);
  });
});

describe('verb forms', () => {
  it('makes the typical learner mistakes as wrong options', () => {
    expect(regularise('go')).toBe('goed');
    expect(regularise('come')).toBe('comed');
    expect(regularise('fly')).toBe('flied');
    expect(regularise('buy')).toBe('buyed');
  });
  it('always offers the right form once, among distinct options, for every verb and form', () => {
    for (const v of content.verbs) {
      for (const form of ['past', 'participle'] as const) {
        for (const count of [3, 4]) {
          const options = verbOptions(v, form, count, seeded(1));
          const correct = form === 'past' ? v.past : v.participle;
          expect(options.length).toBe(count);
          expect(new Set(options).size).toBe(count);
          expect(options.filter((o) => o === correct).length).toBe(1);
        }
      }
    }
  });
});

describe('grammar matches', () => {
  it('build valid plans on every tier', () => {
    for (const mission of grammarMissions) {
      for (let tier = 0; tier < TIERS.length; tier++) {
        const plan = buildMatch(mission, content, atTier(tier), 0, seeded(tier + 3));
        expect(new Set(plan.steps.map((s) => s.key)).size).toBe(plan.steps.length);
        expect(gaps(plan).length).toBe(Math.min(TIERS[tier].gaps, mission.grammar!.items.length));
        for (const g of gaps(plan)) {
          const item = content.grammarItemById.get(g.itemId)!;
          expect(g.options).toContain(item.answer);
          expect(g.options.length).toBe(TIERS[tier].options);
        }
        expect(verbs(plan).length).toBe(Math.min(TIERS[tier].verbForms, mission.grammar!.verbs?.length ?? 0));
        for (const v of verbs(plan)) expect(v.form).toBe(mission.grammar!.verbForm);
        const last = plan.steps[plan.steps.length - 1];
        expect(last.kind === 'pick' && last.shot).toBe(true);
      }
    }
  });
  it('shows the rule card first on the first visit only', () => {
    const fresh = buildMatch(m('m44'), content, newProgress(), 0, seeded(1));
    expect(fresh.steps[0]).toMatchObject({ kind: 'rule', topicId: 'past-irregular' });
    expect(fresh.questionCount).toBe(fresh.steps.filter((s) => s.kind !== 'rule' && s.kind !== 'intro').length);
    const replay = buildMatch(m('m44'), content, done(newProgress(), 'm44'), 0, seeded(1));
    expect(replay.steps.some((s) => s.kind === 'rule')).toBe(false);
  });
  it('season 7 asks the third form, season 5 the past form', () => {
    expect(verbs(buildMatch(m('m54'), content, newProgress(), 0, seeded(2)))[0].form).toBe('participle');
    expect(verbs(buildMatch(m('m45'), content, newProgress(), 0, seeded(2)))[0].form).toBe('past');
  });
});

describe('grammar progress and review', () => {
  it('tallies answers per topic and remembers mistakes until they are put right', () => {
    let p = recordGrammar(newProgress(), 'past-irregular', 'verb:go:past', false, 0);
    p = recordGrammar(p, 'past-irregular', 'item:g001', true, 0);
    expect(p.grammar['past-irregular']).toEqual({ c: 1, w: 1 });
    expect(p.grammarMissed).toEqual(['verb:go:past']);
    p = recordGrammar(p, 'past-irregular', 'verb:go:past', true, 0);
    expect(p.grammarMissed).toEqual([]);
  });
  it('builds progress keys for both kinds of grammar step', () => {
    const plan = buildMatch(m('m44'), content, newProgress(), 0, seeded(4));
    expect(grammarKey(gaps(plan)[0])).toMatch(/^item:g\d{3}$/);
    expect(grammarKey(verbs(plan)[0])).toMatch(/^verb:[a-z]+:past$/);
  });
  it('a review match brings back grammar mistakes first, then exercises from played matches', () => {
    expect(buildReview(content, newProgress(), 0, seeded(1)).steps.some((s) => s.kind === 'gap' || s.kind === 'verb')).toBe(false);
    let p = done(newProgress(), 'm36');
    p = recordGrammar(p, 'past-irregular', 'verb:swim:past', false, 0);
    const plan = buildReview(content, p, 0, seeded(1));
    const g = plan.steps.filter((s): s is GapStep | VerbStep => s.kind === 'gap' || s.kind === 'verb');
    expect(g[0]).toMatchObject({ kind: 'verb', verb: 'swim', form: 'past' });
    expect(g[1]).toMatchObject({ kind: 'gap' });
    expect(m('m36').grammar!.items).toContain((g[1] as GapStep).itemId);
  });
  it('survives save and load, dropping junk', () => {
    const p = recordGrammar(newProgress(), 'future-will', 'item:g070', false, 0);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p)))?.grammar).toEqual(p.grammar);
    const junk = normalizeProgress({ version: 1, grammar: { a: { c: 'x', w: 2 }, b: 7 }, grammarMissed: ['k', 'k', 3] });
    expect(junk?.grammar).toEqual({ a: { c: 0, w: 2 } });
    expect(junk?.grammarMissed).toEqual(['k']);
  });
  it('reports the weakest topic once it has enough answers', () => {
    let p: Progress = { ...newProgress(), player: { name: 'Макс', avatar: 'gold' } };
    for (let i = 0; i < 4; i++) p = recordGrammar(p, 'past-be', `item:x${i}`, false, 0);
    expect(weakestGrammar(content, p)).toBeNull();
    p = recordGrammar(p, 'past-be', 'item:x9', true, 0);
    for (let i = 0; i < 5; i++) p = recordGrammar(p, 'future-will', `item:y${i}`, true, 0);
    expect(weakestGrammar(content, p)).toMatchObject({ id: 'past-be', accuracy: 0.2 });
    expect(grammarStats(content, p)[0].id).toBe('present-simple');
    expect(weeklyReport(content, p, 0)).toContain('Граматика, найважче: Was і were (20%)');
  });
});
