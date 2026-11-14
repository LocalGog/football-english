import type { Achievement, BallSkin, ClubPlayer, Content, Kit, Metric, Progress, Stadium } from './types';
import { shuffle, type Rng } from './engine';
import { goalsTotal, levelInfo, nextMission } from './progress';
import { learnedCount } from './srs';

// ---- Unlocks: every reward is earned by learning, never bought or drawn at random ----

export const kitUnlocked = (kit: Kit, p: Progress): boolean => levelInfo(p.xp).level >= kit.level;
export const ballUnlocked = (ball: BallSkin, p: Progress): boolean => ball.achievement === null || ball.achievement in p.achievements;
export const stadiumUnlocked = (stadium: Stadium, p: Progress): boolean => learnedCount(p) >= stadium.words;

export function currentKit(content: Content, p: Progress): Kit {
  return content.kits.find((k) => k.id === p.player?.avatar) ?? content.kits[0];
}
export function currentBall(content: Content, p: Progress): BallSkin {
  const ball = content.balls.find((b) => b.id === p.club.ball);
  return ball && ballUnlocked(ball, p) ? ball : content.balls[0];
}
export function currentStadium(content: Content, p: Progress): Stadium {
  const stadium = content.stadiums.find((s) => s.id === p.club.stadium);
  return stadium && stadiumUnlocked(stadium, p) ? stadium : content.stadiums[0];
}

// ---- Achievements ----

export function metricValue(metric: Metric, content: Content, p: Progress): number {
  switch (metric) {
    case 'goals':
      return goalsTotal(p);
    case 'learned':
      return learnedCount(p);
    case 'perfect':
      return p.stats.perfectMatches;
    case 'listen':
      return p.stats.listenCorrect;
    case 'days':
      return p.stats.days.length;
    case 'cards':
      return p.club.cards.length;
    case 'season1':
      return content.missions.filter((m) => m.level === 1 && p.missions[m.id]?.completed > 0).length;
  }
}

/** Stamps achievements whose target has been reached; returns them so the UI can celebrate. */
export function unlockAchievements(content: Content, p: Progress, now: number): { progress: Progress; unlocked: Achievement[] } {
  const unlocked = content.achievements.filter((a) => !(a.id in p.achievements) && metricValue(a.metric, content, p) >= a.target);
  if (unlocked.length === 0) return { progress: p, unlocked };
  const achievements = { ...p.achievements };
  for (const a of unlocked) achievements[a.id] = now;
  return { progress: { ...p, achievements }, unlocked };
}

// ---- League table ----

export interface TableRow {
  id: string;
  name: string;
  played: number;
  points: number;
  mine: boolean;
}

/** Small deterministic generator: the table must look the same every time it is opened. */
function seededUnit(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The season the player is in: that of the next unplayed match, or the last one. */
export function currentSeason(content: Content, p: Progress): number {
  return nextMission(content.missions, p)?.level ?? content.levels[content.levels.length - 1].level;
}

/**
 * League of the season. The player's club gets 3 points for a match with a goal and 1 without;
 * rivals have played as many rounds as the player, with results fixed by club strength.
 */
export function leagueTable(content: Content, p: Progress, level: number, clubName: string): TableRow[] {
  const mine = content.missions.filter((m) => m.level === level && p.missions[m.id]?.completed > 0);
  const played = mine.length;
  const myPoints = mine.reduce((sum, m) => sum + (p.missions[m.id].goals > 0 ? 3 : 1), 0);
  const rows: TableRow[] = content.rivals.map((r, i) => {
    let points = 0;
    for (let round = 0; round < played; round++) {
      const roll = seededUnit(level * 10007 + i * 131 + round);
      const win = 0.2 + 0.35 * r.strength;
      points += roll < win ? 3 : roll < win + 0.25 ? 1 : 0;
    }
    return { id: r.id, name: r.name, played, points, mine: false };
  });
  rows.push({ id: 'me', name: clubName, played, points: myPoints, mine: true });
  // On equal points the player's club is placed higher.
  return rows.sort((a, b) => b.points - a.points || Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
}

export const clubName = (p: Progress): string => `FC ${p.player?.name ?? ''}`.trim();

// ---- Scouting (Football Manager task) ----

export type ScoutKey = 'position' | 'number' | 'colour' | 'trait';

export interface ScoutQuestion {
  key: ScoutKey;
  english: string;
  ukrainian: string;
  wordId: string;
  options: string[];
}

const QUESTIONS: Record<ScoutKey, { english: string; ukrainian: string }> = {
  position: { english: 'What position does he play?', ukrainian: 'На якій позиції він грає?' },
  number: { english: 'What is his number?', ukrainian: 'Який у нього номер?' },
  colour: { english: 'What colour is his shirt?', ukrainian: 'Якого кольору його футболка?' },
  trait: { english: 'What is he like?', ukrainian: 'Який він?' },
};
const SCOUT_OPTIONS = 4;

const seen = (p: Progress, wordId: string): boolean => wordId in p.words;

/** Next player on the scouting list. Scouting opens once the positions have been met in a match. */
export function nextScoutPlayer(content: Content, p: Progress): ClubPlayer | null {
  return content.players.find((pl) => !p.club.cards.includes(pl.id) && seen(p, pl.position)) ?? null;
}

export const transfersLeft = (content: Content, p: Progress): boolean => p.club.cards.length < content.players.length;

/** The position is always asked; number, colour and trait only if the player has met those words. */
export function buildScout(player: ClubPlayer, content: Content, p: Progress, rng: Rng = Math.random): ScoutQuestion[] {
  const keys: ScoutKey[] = ['position', 'number', 'colour', 'trait'];
  return keys
    .filter((key) => key === 'position' || seen(p, player[key]))
    .map((key) => {
      const wordId = player[key];
      const category = content.wordById.get(wordId)?.category;
      const others = content.words.filter((w) => w.category === category && w.id !== wordId).map((w) => w.id);
      const options = shuffle([wordId, ...shuffle(others, rng).slice(0, SCOUT_OPTIONS - 1)], rng);
      return { key, wordId, options, ...QUESTIONS[key] };
    });
}

/** English scouting report, line by line. */
export function scoutReport(player: ClubPlayer, content: Content): string[] {
  const en = (id: string) => content.wordById.get(id)?.english ?? id;
  return [
    `Name: ${player.name}.`,
    `Position: ${en(player.position)}.`,
    `Number: ${en(player.number)}.`,
    `His shirt is ${en(player.colour)}.`,
    `He is ${en(player.trait)}.`,
  ];
}

export function signPlayer(p: Progress, playerId: string): Progress {
  if (p.club.cards.includes(playerId) || p.club.tokens <= 0) return p;
  return { ...p, club: { ...p.club, cards: [...p.club.cards, playerId], tokens: p.club.tokens - 1 } };
}
