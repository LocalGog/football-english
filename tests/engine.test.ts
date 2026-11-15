import { describe, expect, it } from 'vitest';
import { content, validateContent } from '../src/lib/content';
import { buildMatch, buildReview, isUnscored, tokenize, TIERS, type MatchPlan, type Rng } from '../src/lib/engine';
import { backupFileName, parseBackup, serializeBackup } from '../src/lib/backup';
import { LEVEL_GATE, levelInfo, newProgress, nextMission, normalizeProgress, playTarget, recordAnswer, recordMatch } from '../src/lib/progress';
import type { Progress } from '../src/lib/types';
import { applyAnswer, dueWordIds, INTERVALS_MS, learnedCount } from '../src/lib/srs';

function seeded(seed: number): Rng {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function checkPlan(plan: MatchPlan, tier = 0): void {
  const last = plan.steps[plan.steps.length - 1];
  expect(last.kind === 'pick' && last.shot).toBe(true);
  expect(new Set(plan.steps.map((s) => s.key)).size).toBe(plan.steps.length);
  expect(plan.questionCount).toBe(plan.steps.filter((s) => !isUnscored(s)).length);
  for (const step of [...plan.steps, plan.spareShot]) {
    if (step.kind === 'pick') {
      expect(step.options).toContain(step.wordId);
      expect(step.options.length).toBe(TIERS[tier].options);
      expect(new Set(step.options).size).toBe(step.options.length);
      for (const id of step.options) expect(content.wordById.has(id)).toBe(true);
    }
    if (step.kind === 'build') {
      const english = content.sentenceById.get(step.sentenceId)!.english;
      const answer = tokenize(english);
      expect(step.answerLength).toBe(answer.length);
      expect(step.tokens.length).toBe(answer.length + (TIERS[tier].buildDistractor ? 1 : 0));
      for (const token of answer) expect(step.tokens).toContain(token);
      expect(step.tokens.slice(0, answer.length).join(' ')).not.toBe(english);
    }
    if (step.kind === 'hear') {
      expect(step.options).toContain(step.sentenceId);
      expect(new Set(step.options).size).toBe(3);
    }
    if (step.kind === 'dialogue') {
      const d = content.dialogues.find((x) => x.id === step.dialogueId)!;
      expect([...step.order].sort()).toEqual(d.options.map((_, i) => i));
    }
  }
}

describe('content', () => {
  it('is internally consistent', () => {
    expect(validateContent(content)).toEqual([]);
  });
  it('meets the stage-1 volume: 200 words, 30 missions, 50 sentences', () => {
    expect(content.words.length).toBeGreaterThanOrEqual(200);
    expect(content.missions.length).toBeGreaterThanOrEqual(30);
    expect(content.sentences.length).toBeGreaterThanOrEqual(50);
  });
  it('missions are ordered by level', () => {
    const levels = content.missions.map((m) => m.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });
  it('every sentence is used by some mission', () => {
    const used = new Set(content.missions.flatMap((m) => m.sentences));
    expect(content.sentences.filter((s) => !used.has(s.id)).map((s) => s.id)).toEqual([]);
  });
  it('every word is taught by some mission', () => {
    const taught = new Set(content.missions.flatMap((m) => m.words));
    expect(content.words.filter((w) => !taught.has(w.id)).map((w) => w.id)).toEqual([]);
  });
});

describe('engine', () => {
  it('builds a valid match for every mission with many seeds', () => {
    for (const mission of content.missions) {
      for (let tier = 0; tier < TIERS.length; tier++) {
        const p = { ...newProgress(), adaptive: { tier } };
        for (let seed = 1; seed <= 15; seed++) checkPlan(buildMatch(mission, content, p, 0, seeded(seed)), tier);
      }
    }
  });

  it('uses all three question modes in a match and in a review', () => {
    const modes = (plan: MatchPlan) => new Set(plan.steps.flatMap((s) => (s.kind === 'pick' && !s.shot ? [s.mode] : [])));
    expect(modes(buildMatch(content.missions[0], content, newProgress(), 0, seeded(2)))).toEqual(new Set(['read', 'listen', 'name']));
    expect(modes(buildReview(content, newProgress(), 0, seeded(2)))).toEqual(new Set(['read', 'listen', 'name']));
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
    checkPlan(buildReview(content, { ...p, adaptive: { tier: 2 } }, 2000, seeded(5)), 2);
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

describe('season gate', () => {
  const finishLevel = (p: Progress, level: number): Progress =>
    content.missions
      .filter((m) => m.level === level)
      .reduce((acc, m) => recordMatch(acc, { missionId: m.id, correct: 1, total: 1, goal: false, xp: 1, seconds: 1, missed: [] }, 0, true), p);
  const learn = (p: Progress, ids: string[]): Progress =>
    ids.reduce((acc, id) => recordAnswer(recordAnswer(acc, id, true, 0), id, true, 0), p);
  const level1Words = [...new Set(content.missions.filter((m) => m.level === 1).flatMap((m) => m.words))];

  it('starts with the first mission', () => {
    expect(playTarget(content, newProgress())).toEqual({ kind: 'mission', mission: content.missions[0] });
  });
  it('keeps season 2 closed until enough season 1 words are learned', () => {
    const played = finishLevel(newProgress(), 1);
    const need = Math.ceil(level1Words.length * LEVEL_GATE);
    expect(playTarget(content, played)).toEqual({ kind: 'review', reason: 'gate', level: 2, missing: need });
    const almost = learn(played, level1Words.slice(0, need - 1));
    expect(playTarget(content, almost)).toMatchObject({ reason: 'gate', missing: 1 });
    const enough = learn(played, level1Words.slice(0, need));
    expect(playTarget(content, enough)).toMatchObject({ kind: 'mission', mission: { level: 2 } });
  });
  it('offers free review once every mission is done', () => {
    let p = newProgress();
    for (const l of content.levels) p = finishLevel(p, l.level);
    expect(playTarget(content, p)).toEqual({ kind: 'review', reason: 'done' });
  });
});

describe('backup', () => {
  const now = new Date('2026-11-14T10:00:00Z');
  const p = recordAnswer({ ...newProgress(), player: { name: 'Max', avatar: 'blue' }, xp: 70 }, 'ball', true, 5);
  it('round-trips progress', () => {
    expect(parseBackup(serializeBackup(p, now))).toEqual(p);
    expect(backupFileName(now)).toBe('football-english-backup-2026-11-14.json');
  });
  it('rejects anything that is not our backup', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('[]')).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'other', progress: p }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'football-english', progress: { version: 9 } }))).toBeNull();
    expect(parseBackup(JSON.stringify({ app: 'football-english', progress: newProgress() }))).toBeNull(); // no player
    expect(parseBackup('x'.repeat(1_000_001))).toBeNull();
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
    const p1 = recordMatch(p0, { missionId: 'm01', correct: 10, total: 13, goal: true, xp: 150, seconds: 200, missed: [] }, 0, true);
    expect(p1.xp).toBe(150);
    expect(p1.missions.m01).toEqual({ completed: 1, goals: 1, bestCorrect: 10 });
    expect(nextMission(content.missions, p1)?.id).toBe('m02');
    let all = p0;
    for (const m of content.missions) all = recordMatch(all, { missionId: m.id, correct: 1, total: 1, goal: false, xp: 1, seconds: 1, missed: [] }, 0, true);
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
