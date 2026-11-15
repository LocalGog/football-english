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

/**
 * A real footballer. Only facts that do not change from season to season are kept:
 * clubs and current shirt numbers are left out on purpose.
 */
export interface ClubPlayer {
  id: string;
  name: string;
  /** Name that fits a small card, usually the surname. */
  short: string;
  /** English country name, shown as is. */
  country: string;
  /** Word ids: what the scouting task asks about. Null means the fact is not used. */
  position: string;
  /** The number the player is famous for. */
  number: string | null;
  /** National team home shirt, or the famous shirt when colourNote is 'famous'. */
  colour: string | null;
  colourNote?: 'national' | 'famous';
  /** Only well-known, positive traits. */
  trait: string | null;
  /** Card tier: 1 bronze, 2 silver, 3 gold. */
  tier: 1 | 2 | 3;
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

export type Metric = 'goals' | 'learned' | 'perfect' | 'listen' | 'days' | 'cards' | 'season1' | 'spoken';

export interface DialogueLine {
  speaker: string;
  english: string;
  ukrainian: string;
}

export interface Dialogue {
  id: string;
  /** Mission whose match ends with this dialogue. */
  mission: string;
  lines: DialogueLine[];
  /** Possible replies; `answer` is the index of the right one. */
  options: { english: string; ukrainian: string }[];
  answer: number;
}

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
  dialogues: Dialogue[];
  /** Category id -> Ukrainian topic name. */
  categories: Record<string, string>;
  words: Word[];
  sentences: Sentence[];
  missions: Mission[];
  wordById: Map<string, Word>;
  sentenceById: Map<string, Sentence>;
}

export type PickMode = 'read' | 'listen' | 'name';

export interface ModeTally {
  c: number;
  w: number;
}

export interface WordStat {
  correct: number;
  wrong: number;
  lastReview: number | null;
  /** 0 = new … 5 = solid. */
  mastery: number;
  nextReview: number | null;
  /** Right and wrong answers per task type: shows whether reading, listening or recall is the weak spot. */
  modes?: Partial<Record<PickMode, ModeTally>>;
  /** Wrong options picked instead of this word, with counts. */
  confused?: Record<string, number>;
  /** When the word first counted as learned; never moved back, so a word is counted once. */
  learnedAt?: number;
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
  /** Words practised in the pronunciation drill. */
  spoken: number;
  /** Local dates (YYYY-MM-DD) on which a match was finished. */
  days: string[];
}

/** Activity of one local calendar day. */
export interface DayStat {
  seconds: number;
  matches: number;
  answers: number;
  correct: number;
  listenAnswers: number;
  listenCorrect: number;
  /** Words that became learned on this day. */
  learned: number;
}

export interface ParentSettings {
  /** Salted hash of the PIN; null until the parent sets one. */
  pinHash: string | null;
  pinSalt: string | null;
  /** Recommended practice per day, in minutes. */
  dailyMinutes: number;
  /** Time of the last PIN reset, shown to the parent. */
  pinResetAt: number | null;
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
  /** Difficulty tier 0..2, moved one step at a time by match results. */
  adaptive: { tier: number };
  /** Local date (YYYY-MM-DD) -> activity. */
  history: Record<string, DayStat>;
  parent: ParentSettings;
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
  /** Words answered wrong at least once in this match. */
  missed: string[];
}
