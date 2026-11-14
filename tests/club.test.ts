import { describe, expect, it } from 'vitest';
import {
  ballUnlocked, buildScout, currentBall, currentStadium, kitUnlocked, leagueTable, metricValue, nextScoutPlayer, scoutReport, signPlayer,
  stadiumUnlocked, transfersLeft, unlockAchievements,
} from '../src/lib/club';
import { content } from '../src/lib/content';
import { localDay, newProgress, normalizeProgress, recordAnswer, recordMatch, XP_PER_LEVEL } from '../src/lib/progress';
import type { MatchResult, Progress } from '../src/lib/types';

const DAY = 86_400_000;
const noon = (day: number) => new Date(2026, 10, 1 + day, 12).getTime();
const match = (missionId: string, goal: boolean, perfect = false): MatchResult => ({
  missionId, goal, correct: perfect ? 16 : 10, total: 16, xp: 100, seconds: 60,
});
const learn = (p: Progress, ids: string[]): Progress => ids.reduce((acc, id) => recordAnswer(recordAnswer(acc, id, true, 0), id, true, 0), p);
const withPlayer = (): Progress => ({ ...newProgress(), player: { name: 'Max', avatar: 'gold' } });

describe('match records', () => {
  it('a goal earns a transfer while there is someone to sign', () => {
    const p = recordMatch(newProgress(), match('m01', true), noon(0), true);
    expect(p.club.tokens).toBe(1);
    expect(recordMatch(p, match('m02', false), noon(0), true).club.tokens).toBe(1);
    expect(recordMatch(p, match('m02', true), noon(0), false).club.tokens).toBe(1);
  });
  it('counts perfect matches and distinct days', () => {
    let p = recordMatch(newProgress(), match('m01', true, true), noon(0), true);
    p = recordMatch(p, match('m02', true), noon(0) + 1000, true);
    p = recordMatch(p, match('m03', false, true), noon(1), true); // no goal: not perfect
    expect(p.stats.perfectMatches).toBe(1);
    expect(p.stats.days).toEqual([localDay(noon(0)), localDay(noon(1))]);
  });
  it('counts correct listening answers only', () => {
    let p = recordAnswer(newProgress(), 'ball', true, 0, 'listen');
    p = recordAnswer(p, 'ball', false, 0, 'listen');
    p = recordAnswer(p, 'ball', true, 0, 'read');
    expect(p.stats.listenCorrect).toBe(1);
  });
  it('old saves without a club load with an empty one, and bad club data is repaired', () => {
    const old = normalizeProgress({ version: 1, player: { name: 'Max', avatar: 'red' }, xp: 10, stats: { secondsPlayed: 5 } });
    expect(old?.club).toEqual({ cards: [], tokens: 0, ball: 'classic', stadium: 'street' });
    expect(old?.stats).toEqual({ secondsPlayed: 5, perfectMatches: 0, listenCorrect: 0, days: [] });
    const bad = normalizeProgress({ version: 1, club: { cards: ['p01', 'p01', 7], tokens: -3, ball: 5 }, achievements: { a: 'x', b: 2 } });
    expect(bad?.club).toEqual({ cards: ['p01'], tokens: 0, ball: 'classic', stadium: 'street' });
    expect(bad?.achievements).toEqual({ b: 2 });
  });
});

describe('achievements', () => {
  it('unlocks First Goal once and reports it', () => {
    const scored = recordMatch(newProgress(), match('m01', true), noon(0), true);
    const first = unlockAchievements(content, scored, 123);
    expect(first.unlocked.map((a) => a.id)).toEqual(['first-goal']);
    expect(first.progress.achievements['first-goal']).toBe(123);
    expect(unlockAchievements(content, first.progress, 456).unlocked).toEqual([]);
  });
  it('covers every achievement from the spec with a reachable target', () => {
    const ids = content.achievements.map((a) => a.id);
    for (const id of ['first-goal', 'first-20-words', 'perfect-match', 'listening-master', 'football-genius', 'seven-days']) expect(ids).toContain(id);
    let p = learn(newProgress(), content.words.slice(0, 100).map((w) => w.id));
    for (let d = 0; d < 7; d++) p = recordMatch(p, match('m01', true, true), noon(d), true);
    for (let i = 0; i < 50; i++) p = recordAnswer(p, 'ball', true, 0, 'listen');
    for (const m of content.missions.filter((m) => m.level === 1)) p = recordMatch(p, match(m.id, true), noon(8), true);
    p = { ...p, club: { ...p.club, cards: content.players.slice(0, 11).map((c) => c.id) } };
    const { progress } = unlockAchievements(content, p, 1);
    expect(Object.keys(progress.achievements).sort()).toEqual([...ids].sort());
    expect(metricValue('days', content, p)).toBe(8);
  });
  it('seven days means seven different days, with no penalty for gaps', () => {
    let p = newProgress();
    for (const d of [0, 0, 3, 10, 11, 20, 40]) p = recordMatch(p, match('m01', false), noon(d), true);
    expect(unlockAchievements(content, p, 1).unlocked.map((a) => a.id)).not.toContain('seven-days');
    p = recordMatch(p, match('m01', false), noon(41) + DAY, true);
    expect(unlockAchievements(content, p, 1).unlocked.map((a) => a.id)).toContain('seven-days');
  });
});

describe('unlocks', () => {
  it('kits open by level, balls by achievement, stadiums by learned words', () => {
    const fresh = withPlayer();
    const stripes = content.kits.find((k) => k.id === 'stripes')!;
    expect(kitUnlocked(stripes, fresh)).toBe(false);
    expect(kitUnlocked(stripes, { ...fresh, xp: XP_PER_LEVEL * 2 })).toBe(true);
    const golden = content.balls.find((b) => b.id === 'golden')!;
    expect(ballUnlocked(golden, fresh)).toBe(false);
    expect(ballUnlocked(golden, { ...fresh, achievements: { 'first-goal': 1 } })).toBe(true);
    const school = content.stadiums.find((s) => s.id === 'school')!;
    expect(stadiumUnlocked(school, fresh)).toBe(false);
    expect(stadiumUnlocked(school, learn(fresh, content.words.slice(0, 20).map((w) => w.id)))).toBe(true);
  });
  it('a locked or unknown selection falls back to the starter item', () => {
    const cheat = { ...withPlayer(), club: { cards: [], tokens: 0, ball: 'genius', stadium: 'champions' } };
    expect(currentBall(content, cheat).id).toBe('classic');
    expect(currentStadium(content, cheat).id).toBe('street');
    expect(currentBall(content, { ...cheat, club: { ...cheat.club, ball: 'nope' } }).id).toBe('classic');
  });
});

describe('league table', () => {
  it('is stable, has eight clubs and starts level', () => {
    const p = withPlayer();
    const table = leagueTable(content, p, 1, 'FC Max');
    expect(table).toEqual(leagueTable(content, p, 1, 'FC Max'));
    expect(table.length).toBe(8);
    expect(table[0]).toMatchObject({ mine: true, points: 0, played: 0 });
  });
  it('gives 3 points for a match with a goal and 1 without, and a replay can improve the result', () => {
    let p = recordMatch(withPlayer(), match('m01', true), noon(0), true);
    p = recordMatch(p, match('m02', false), noon(0), true);
    const mine = () => leagueTable(content, p, 1, 'FC Max').find((r) => r.mine)!;
    expect(mine()).toMatchObject({ points: 4, played: 2 });
    p = recordMatch(p, match('m02', true), noon(0), true);
    expect(mine()).toMatchObject({ points: 6, played: 2 });
  });
  it('a player who scores in every match of season 1 finishes first', () => {
    let p = withPlayer();
    for (const m of content.missions.filter((m) => m.level === 1)) p = recordMatch(p, match(m.id, true), noon(0), true);
    const table = leagueTable(content, p, 1, 'FC Max');
    expect(table[0].mine).toBe(true);
    for (const row of table) expect(row.points).toBeLessThanOrEqual(row.played * 3);
  });
});

describe('scouting', () => {
  const knowsPositions = (): Progress => learn(withPlayer(), ['goalkeeper', 'defender', 'striker', 'midfielder']);

  it('is closed until positions have been met', () => {
    expect(nextScoutPlayer(content, withPlayer())).toBeNull();
    expect(nextScoutPlayer(content, knowsPositions())?.id).toBe('p01');
  });
  it('asks only about words the player has met; the position always', () => {
    const tom = content.players[0];
    const early = buildScout(tom, content, knowsPositions());
    expect(early.map((q) => q.key)).toEqual(['position']);
    const later = buildScout(tom, content, learn(knowsPositions(), [tom.number, tom.colour, tom.trait]));
    expect(later.map((q) => q.key)).toEqual(['position', 'number', 'colour', 'trait']);
    for (const q of later) {
      expect(q.options).toContain(q.wordId);
      expect(new Set(q.options).size).toBe(4);
      const category = content.wordById.get(q.wordId)!.category;
      for (const id of q.options) expect(content.wordById.get(id)!.category).toBe(category);
    }
  });
  it('writes the report in English from the dictionary', () => {
    expect(scoutReport(content.players[4], content)).toEqual([
      'Name: Leo Hart.', 'Position: striker.', 'Number: nine.', 'His shirt is yellow.', 'He is fast.',
    ]);
  });
  it('signing spends a transfer, needs one, and never duplicates a player', () => {
    const p = { ...knowsPositions(), club: { cards: [], tokens: 1, ball: 'classic', stadium: 'street' } };
    const signed = signPlayer(p, 'p01');
    expect(signed.club).toMatchObject({ cards: ['p01'], tokens: 0 });
    expect(signPlayer(signed, 'p02')).toBe(signed);
    expect(signPlayer({ ...signed, club: { ...signed.club, tokens: 1 } }, 'p01').club.cards).toEqual(['p01']);
    expect(nextScoutPlayer(content, signed)?.id).toBe('p02');
  });
  it('knows when the whole squad is signed', () => {
    const full = { ...withPlayer(), club: { cards: content.players.map((c) => c.id), tokens: 0, ball: 'classic', stadium: 'street' } };
    expect(transfersLeft(content, full)).toBe(false);
    expect(transfersLeft(content, withPlayer())).toBe(true);
  });
});
