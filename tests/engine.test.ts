import { describe, expect, it } from 'vitest';
import { content, validateContent } from '../src/lib/content';
import { buildMatch, buildReview, tokenize, type MatchPlan, type Rng } from '../src/lib/engine';
import { levelInfo, newProgress, nextMission, normalizeProgress, recordAnswer, recordMatch } from '../src/lib/progress';
import { applyAnswer, dueWordIds, INTERVALS_MS, learnedCount } from '../src/lib/srs';

function seeded(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function checkPlan(plan: MatchPlan): void {
  const last = plan.steps[plan.steps.length - 1];
  expect(last.kind === 'pick' && last.shot).toBe(true);
  expect(new Set(plan.steps.map((s) => s.key)).size).toBe(plan.steps.length);
  expect(plan.questionCount).toBe(plan.steps.filter((s) => s.kind !== 'intro').length);
  for (const step of [...plan.steps, plan.spareShot]) {
    if (step.kind === 'pick') {
      expect(step.options).toContain(step.wordId);
      expect(step.options.length).toBe(4);
      expect(new Set(step.options).size).toBe(4);
      for (const id of step.options) expect(content.wordById.has(id)).toBe(true);
    }
    if (step.kind === 'build') {
      const english = content.sentenceById.get(step.sentenceId)!.english;
      expect([...step.tokens].sort()).toEqual(tokenize(english).sort());
      expect(step.tokens.join(' ')).not.toBe(english);
    }
  }
}

describe('content', () => {
  it('is internally consistent', () => {
    expect(validateContent(content)).toEqual([]);
  });
  it('every word is taught by some mission', () => {
    const taught = new Set(content.missions.flatMap((m) => m.words));
    expect(content.words.filter((w) => !taught.has(w.id)).map((w) => w.id)).toEqual([]);
  });
});

describe('engine', () => {
  it('builds a valid match for every mission with many seeds', () => {
    for (const mission of content.missions) {
      for (let seed = 1; seed <= 40; seed++) checkPlan(buildMatch(mission, content, newProgress(), 0, seeded(seed)));
    }
  });

  it('introduces only words the player has not met', () => {
    const mission = content.missions[0];
    const fresh = buildMatch(mission, content, newProgress(), 0, seeded(1));
    expect(fresh.steps.filter((s) => s.kind === 'intro').length).toBe(mission.words.length);
    const known = recordAnswer(newProgress(), mission.words[0], true, 0);
    const replay = buildMatch(mission, content, known, 0, seeded(1));
    expect(replay.steps.filter((s) => s.kind === 'intro').length).toBe(mission.words.length - 1);
  });

  it('brings a missed word from an earlier mission back into the listening round', () => {
    const missed = recordAnswer(newProgress(), 'ball', false, 1000);
    const plan = buildMatch(content.missions[1], content, missed, 2000, seeded(3));
    expect(plan.steps.some((s) => s.kind === 'pick' && s.mode === 'listen' && s.wordId === 'ball')).toBe(true);
  });

  it('builds a review match with and without history', () => {
    checkPlan(buildReview(content, newProgress(), 0, seeded(5)));
    let p = newProgress();
    for (const w of content.words.slice(0, 20)) p = recordAnswer(p, w.id, w.id !== 'goal', 1000);
    const plan = buildReview(content, p, 2000, seeded(5));
    checkPlan(plan);
    expect(plan.steps.some((s) => s.kind === 'pick' && s.wordId === 'goal')).toBe(true);
  });
});

describe('spaced repetition', () => {
  it('walks through the intervals and caps at the last one', () => {
    let s = applyAnswer(undefined, true, 0);
    expect(s.nextReview).toBe(INTERVALS_MS[0]);
    for (let i = 1; i < 8; i++) s = applyAnswer(s, true, 0);
    expect(s.mastery).toBe(5);
    expect(s.nextReview).toBe(INTERVALS_MS[4]);
  });
  it('a miss steps back once and makes the word due now', () => {
    let s = applyAnswer(applyAnswer(undefined, true, 0), true, 0);
    s = applyAnswer(s, false, 500);
    expect(s).toMatchObject({ mastery: 1, wrong: 1, nextReview: 500 });
    expect(applyAnswer(undefined, false, 0).mastery).toBe(0);
  });
  it('lists due words and counts learned ones', () => {
    let p = recordAnswer(newProgress(), 'ball', true, 0);
    expect(dueWordIds(p, 1)).toEqual([]);
    expect(dueWordIds(p, INTERVALS_MS[0])).toEqual(['ball']);
    expect(learnedCount(p)).toBe(0);
    p = recordAnswer(p, 'ball', true, 0);
    expect(learnedCount(p)).toBe(1);
  });
});

describe('progress', () => {
  it('levels up every 150 XP', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, status: 'Новачок' });
    expect(levelInfo(149).level).toBe(1);
    expect(levelInfo(150)).toMatchObject({ level: 2, into: 0 });
    expect(levelInfo(150 * 50).status).toBe('Зірка клубу');
  });
  it('records a match and unlocks the next mission', () => {
    const p0 = newProgress();
    expect(nextMission(content.missions, p0)?.id).toBe('m01');
    const p1 = recordMatch(p0, { missionId: 'm01', correct: 10, total: 13, goal: true, xp: 150, seconds: 200 });
    expect(p1.xp).toBe(150);
    expect(p1.missions.m01).toEqual({ completed: 1, goals: 1, bestCorrect: 10 });
    expect(nextMission(content.missions, p1)?.id).toBe('m02');
    let all = p0;
    for (const m of content.missions) all = recordMatch(all, { missionId: m.id, correct: 1, total: 1, goal: false, xp: 1, seconds: 1 });
    expect(nextMission(content.missions, all)).toBeNull();
  });
  it('rejects foreign data and repairs damaged saves', () => {
    expect(normalizeProgress(null)).toBeNull();
    expect(normalizeProgress('x')).toBeNull();
    expect(normalizeProgress({ version: 2 })).toBeNull();
    const fixed = normalizeProgress({
      version: 1, player: { name: '  Max  ', avatar: 'red' }, xp: -5,
      words: { ball: { mastery: 99, correct: 'x' } }, settings: { accent: 'fr', rate: 9 },
    });
    expect(fixed?.player).toEqual({ name: 'Max', avatar: 'red' });
    expect(fixed?.xp).toBe(0);
    expect(fixed?.words.ball).toMatchObject({ mastery: 5, correct: 0, nextReview: null });
    expect(fixed?.settings).toEqual({ accent: 'en-GB', rate: 1.1 });
    const round = normalizeProgress(JSON.parse(JSON.stringify(recordAnswer(newProgress(), 'ball', true, 7))));
    expect(round?.words.ball.lastReview).toBe(7);
  });
});
