import { describe, expect, it } from 'vitest';
import { serializeBackup, parseBackup } from '../src/lib/backup';
import { dailyBars, minutesPick } from '../src/lib/charts';
import { content } from '../src/lib/content';
import { checkPin, hashPin, isValidPin, makeSalt } from '../src/lib/pin';
import { DEFAULT_DAILY_MINUTES, newProgress, normalizeProgress, recordAnswer, recordMatch, resetProgress } from '../src/lib/progress';
import { accuracyByMode, hardWords, isMastered, lastDays, periodSummary, todayMinutes, topics } from '../src/lib/stats';
import type { MatchResult, Progress } from '../src/lib/types';

const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).getTime();
const match = (seconds: number, correct = 10, total = 14): MatchResult => ({ missionId: 'm01', correct, total, goal: true, xp: 10, seconds, missed: [] });
const learn = (p: Progress, id: string, now: number) => recordAnswer(recordAnswer(p, id, true, now), id, true, now);

describe('daily history', () => {
  it('records time, answers, listening and newly learned words per local day', () => {
    let p = recordMatch(newProgress(), match(300), at(14), true);
    p = recordAnswer(p, 'ball', true, at(14), 'listen');
    p = recordAnswer(p, 'ball', false, at(14), 'listen', 'goal');
    p = learn(p, 'goal', at(14));
    expect(p.history['2026-11-14']).toEqual({ seconds: 300, matches: 1, answers: 4, correct: 3, listenAnswers: 2, listenCorrect: 1, learned: 1 });
  });
  it('counts a word as learned once, even if it slips and is learned again', () => {
    let p = learn(newProgress(), 'ball', at(10));
    p = recordAnswer(recordAnswer(p, 'ball', false, at(11)), 'ball', false, at(11));
    p = learn(p, 'ball', at(12));
    expect(p.history['2026-11-10'].learned).toBe(1);
    expect(p.history['2026-11-12'].learned).toBe(0);
    expect(p.words.ball.learnedAt).toBe(at(10));
  });
  it('keeps at most 400 days', () => {
    let p = newProgress();
    for (let d = 0; d < 405; d++) p = recordMatch(p, match(60), new Date(2025, 0, 1 + d, 12).getTime(), true);
    const days = Object.keys(p.history).sort();
    expect(days.length).toBe(400);
    expect(days[0]).toBe('2025-01-06');
  });
});

describe('periods and charts', () => {
  it('lists calendar days across a month end and a DST change', () => {
    expect(lastDays(3, at(1))).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    const overDst = lastDays(7, new Date(2026, 2, 31, 0, 30).getTime());
    expect(overDst[0]).toBe('2026-03-25');
    expect(new Set(overDst).size).toBe(7);
  });
  it('sums the last 7 and 30 days', () => {
    let p = recordMatch(newProgress(), match(600, 14, 14), at(14), true);
    p = recordMatch(p, match(300, 7, 14), at(10), true);
    p = recordMatch(p, match(900), at(1), true); // outside the week, inside the month
    p = recordAnswer(p, 'ball', true, at(14), 'listen');
    const week = periodSummary(p, 7, at(14, 20));
    expect(week).toMatchObject({ minutes: 15, matches: 2, activeDays: 2, listenAnswers: 1, listenAccuracy: 1 });
    expect(periodSummary(p, 30, at(14, 20))).toMatchObject({ minutes: 30, matches: 3, activeDays: 3 });
    expect(periodSummary(newProgress(), 7, at(14)).accuracy).toBeNull();
    expect(todayMinutes(p, at(14, 23))).toBe(10);
  });
  it('builds one column per day with the right values and labels', () => {
    const p = recordMatch(newProgress(), match(480), at(14), true);
    const bars = dailyBars(p, 7, at(14), minutesPick);
    expect(bars.map((b) => b.label)).toEqual(['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']);
    expect(bars[6]).toMatchObject({ key: '2026-11-14', value: 8, title: 'Сб, 14.11' });
    expect(bars.slice(0, 6).every((b) => b.value === 0)).toBe(true);
    expect(dailyBars(p, 30, at(14), minutesPick)[29].label).toBe('14');
  });
});

describe('parent statistics', () => {
  it('reports accuracy by task type', () => {
    let p = recordAnswer(newProgress(), 'ball', true, 0, 'read');
    p = recordAnswer(p, 'ball', false, 0, 'listen', 'goal');
    p = recordAnswer(p, 'goal', true, 0, 'listen');
    expect(accuracyByMode(p)).toEqual([
      { mode: 'read', answers: 1, accuracy: 1 },
      { mode: 'listen', answers: 2, accuracy: 0.5 },
      { mode: 'name', answers: 0, accuracy: null },
    ]);
  });
  it('explains hard words: weak task type and what they are confused with', () => {
    let p = recordAnswer(newProgress(), 'ball', false, 0, 'listen', 'goal');
    p = recordAnswer(p, 'ball', false, 0, 'listen', 'goal');
    p = recordAnswer(p, 'ball', true, 0, 'read');
    expect(hardWords(content, p)).toEqual([{ id: 'ball', wrong: 2, correct: 1, weakMode: 'listen', confusedWith: ['goal'] }]);
  });
  it('marks a topic mastered at 80% of its words learned, in teaching order', () => {
    const colours = content.words.filter((w) => w.category === 'colours').map((w) => w.id);
    let p = newProgress();
    for (const id of colours.slice(0, 4)) p = learn(p, id, 0);
    const before = topics(content, p).find((t) => t.id === 'colours')!;
    expect(before).toMatchObject({ learned: 4, total: 6, seen: 4 });
    expect(isMastered(before)).toBe(false);
    p = learn(p, colours[4], 0);
    expect(isMastered(topics(content, p).find((t) => t.id === 'colours')!)).toBe(true);
    expect(topics(content, p)[0].id).toBe('basics');
    expect(topics(content, p).length).toBe(Object.keys(content.categories).length);
  });
});

describe('parent settings', () => {
  it('validates PINs and checks them against a salted hash', async () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    const salt = makeSalt();
    const hash = await hashPin('1234', salt);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('1234');
    expect(await checkPin('1234', salt, hash)).toBe(true);
    expect(await checkPin('4321', salt, hash)).toBe(false);
    expect(await hashPin('1234', makeSalt())).not.toBe(hash);
  });
  it('loads defaults for old saves and rejects bad parent data', () => {
    expect(normalizeProgress({ version: 1 })?.parent).toEqual({ pinHash: null, pinSalt: null, dailyMinutes: DEFAULT_DAILY_MINUTES, pinResetAt: null });
    const bad = normalizeProgress({ version: 1, parent: { pinHash: 'not hex!', pinSalt: 'x', dailyMinutes: 999 }, history: { nope: {}, '2026-11-14': { seconds: -5, matches: 2 } } });
    expect(bad?.parent).toMatchObject({ pinHash: null, pinSalt: null, dailyMinutes: DEFAULT_DAILY_MINUTES });
    expect(bad?.history).toEqual({ '2026-11-14': { seconds: 0, matches: 2, answers: 0, correct: 0, listenAnswers: 0, listenCorrect: 0, learned: 0 } });
  });
  it('a backup carries history and parent settings', async () => {
    const salt = makeSalt();
    let p: Progress = { ...newProgress(), player: { name: 'Max', avatar: 'gold' } };
    p = { ...recordMatch(p, match(120), at(14), true), parent: { pinHash: await hashPin('1234', salt), pinSalt: salt, dailyMinutes: 15, pinResetAt: null } };
    expect(parseBackup(serializeBackup(p, new Date(at(14))))).toEqual(p);
  });
  it('reset clears progress but keeps sound settings and parent settings', () => {
    let p: Progress = { ...newProgress(), player: { name: 'Max', avatar: 'gold' }, settings: { accent: 'en-US', rate: 0.7 } };
    p = { ...recordMatch(learn(p, 'ball', at(14)), match(120), at(14), true), parent: { ...p.parent, dailyMinutes: 20 } };
    const fresh = resetProgress(p);
    expect(fresh.player).toBeNull();
    expect(fresh.words).toEqual({});
    expect(fresh.history).toEqual({});
    expect(fresh.xp).toBe(0);
    expect(fresh.settings).toEqual({ accent: 'en-US', rate: 0.7 });
    expect(fresh.parent.dailyMinutes).toBe(20);
  });
});
