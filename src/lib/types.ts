export interface Word {
  id: string;
  english: string;
  ukrainian: string;
  category: string;
  difficulty: number;
  pronunciation: string;
  /** Emoji / short glyph for now; a relative path once real artwork is added. */
  image: string;
  examples: string[];
  audio: string | null;
}

export interface Sentence {
  id: string;
  english: string;
  ukrainian: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  level: number;
  mission_type: string;
  words: string[];
  sentences: string[];
  rewards: { xp: number };
  estimated_duration: number;
}

export interface Level {
  level: number;
  title: string;
}

export interface ClubPlayer {
  id: string;
  name: string;
  /** Word ids: what the scouting task asks about. */
  position: string;
  number: string;
  colour: string;
  trait: string;
  rating: number;
}

export interface Kit {
  id: string;
  main: string;
  trim: string;
  accent?: string;
  pattern: 'plain' | 'stripes' | 'hoops' | 'sash';
  /** Player level that unlocks the kit. */
  level: number;
}

export interface BallSkin {
  id: string;
  name: string;
  base: string;
  mark: string;
  /** Achievement that unlocks the ball; null = available from the start. */
  achievement: string | null;
}

export interface Stadium {
  id: string;
  name: string;
  description: string;
  /** Learned words needed to move in. */
  words: number;
  light: string;
  dark: string;
}

export interface Rival {
  id: string;
  name: string;
  /** 0..1: how often the club wins its league matches. */
  strength: number;
}

export type Metric = 'goals' | 'learned' | 'perfect' | 'listen' | 'days' | 'cards' | 'season1';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  metric: Metric;
  target: number;
}

export interface Content {
  levels: Level[];
  players: ClubPlayer[];
  kits: Kit[];
  balls: BallSkin[];
  stadiums: Stadium[];
  rivals: Rival[];
  achievements: Achievement[];
  words: Word[];
  sentences: Sentence[];
  missions: Mission[];
  wordById: Map<string, Word>;
  sentenceById: Map<string, Sentence>;
}

export interface WordStat {
  correct: number;
  wrong: number;
  lastReview: number | null;
  /** 0 = new … 5 = solid. */
  mastery: number;
  nextReview: number | null;
}

export interface MissionStat {
  completed: number;
  goals: number;
  bestCorrect: number;
}

export type Accent = 'en-GB' | 'en-US';

export interface Settings {
  accent: Accent;
  /** Speech rate, 0.5–1.1. */
  rate: number;
}

export interface Player {
  name: string;
  avatar: string;
}

export interface ClubState {
  /** Ids of signed players, in signing order. */
  cards: string[];
  /** Unused transfers: one is earned with every goal. */
  tokens: number;
  ball: string;
  stadium: string;
}

export interface Stats {
  secondsPlayed: number;
  perfectMatches: number;
  listenCorrect: number;
  /** Local dates (YYYY-MM-DD) on which a match was finished. */
  days: string[];
}

export interface Progress {
  version: 1;
  player: Player | null;
  xp: number;
  missions: Record<string, MissionStat>;
  words: Record<string, WordStat>;
  settings: Settings;
  stats: Stats;
  club: ClubState;
  /** Achievement id -> time unlocked. */
  achievements: Record<string, number>;
}

export interface MatchResult {
  missionId: string;
  correct: number;
  total: number;
  goal: boolean;
  xp: number;
  seconds: number;
}

export type PickMode = 'read' | 'listen' | 'name';
