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

export interface Content {
  levels: Level[];
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

export interface Progress {
  version: 1;
  player: Player | null;
  xp: number;
  missions: Record<string, MissionStat>;
  words: Record<string, WordStat>;
  settings: Settings;
  stats: { secondsPlayed: number };
}

export interface MatchResult {
  missionId: string;
  correct: number;
  total: number;
  goal: boolean;
  xp: number;
  seconds: number;
}
