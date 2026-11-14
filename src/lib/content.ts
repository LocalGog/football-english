import wordsJson from '../content/words.json';
import sentencesJson from '../content/sentences.json';
import missionsJson from '../content/missions.json';
import levelsJson from '../content/levels.json';
import playersJson from '../content/players.json';
import clubJson from '../content/club.json';
import achievementsJson from '../content/achievements.json';
import dialoguesJson from '../content/dialogues.json';
import categoriesJson from '../content/categories.json';
import type { Achievement, BallSkin, ClubPlayer, Content, Dialogue, Kit, Level, Mission, Rival, Sentence, Stadium, Word } from './types';

export interface ClubCatalog {
  players: ClubPlayer[];
  kits: Kit[];
  balls: BallSkin[];
  stadiums: Stadium[];
  rivals: Rival[];
  achievements: Achievement[];
  dialogues: Dialogue[];
  categories: Record<string, string>;
}

export function makeContent(words: Word[], sentences: Sentence[], missions: Mission[], levels: Level[], club: ClubCatalog): Content {
  return {
    ...club,
    levels,
    words,
    sentences,
    missions,
    wordById: new Map(words.map((w) => [w.id, w])),
    sentenceById: new Map(sentences.map((s) => [s.id, s])),
  };
}

/** Returns a list of human-readable problems; empty means the content is consistent. */
export function validateContent(c: Content): string[] {
  const problems: string[] = [];
  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };
  dup(c.words.map((w) => w.id), 'word');
  dup(c.sentences.map((s) => s.id), 'sentence');
  dup(c.missions.map((m) => m.id), 'mission');
  // Answer options show one side of a pair, so both sides must be unambiguous.
  dup(c.words.map((w) => w.english.toLowerCase()), 'word english');
  dup(c.words.map((w) => w.ukrainian.toLowerCase()), 'word ukrainian');
  dup(c.sentences.map((s) => s.english), 'sentence english');
  for (const w of c.words) {
    if (!c.categories[w.category]) problems.push(`word ${w.id}: category ${w.category} has no topic name`);
    if (!w.english.trim() || !w.ukrainian.trim() || !w.image.trim()) problems.push(`word ${w.id}: empty field`);
  }
  for (const s of c.sentences) {
    if (s.english.trim().split(/\s+/).length < 2) problems.push(`sentence ${s.id}: needs at least 2 words`);
  }
  for (const m of c.missions) {
    if (m.words.length < 4) problems.push(`mission ${m.id}: needs at least 4 words`);
    if (!c.levels.some((l) => l.level === m.level)) problems.push(`mission ${m.id}: unknown level ${m.level}`);
    for (const id of m.words) if (!c.wordById.has(id)) problems.push(`mission ${m.id}: unknown word ${id}`);
    for (const id of m.sentences) if (!c.sentenceById.has(id)) problems.push(`mission ${m.id}: unknown sentence ${id}`);
  }
  dup(c.players.map((p) => p.id), 'player');
  dup(c.players.map((p) => p.name), 'player name');
  dup(c.achievements.map((a) => a.id), 'achievement');
  dup(c.dialogues.map((d) => d.id), 'dialogue');
  dup(c.dialogues.map((d) => d.mission), 'dialogue mission');
  for (const d of c.dialogues) {
    if (!c.missions.some((m) => m.id === d.mission)) problems.push(`dialogue ${d.id}: unknown mission ${d.mission}`);
    if (d.lines.length === 0 || d.options.length < 3) problems.push(`dialogue ${d.id}: needs a line and 3 options`);
    if (!d.options[d.answer]) problems.push(`dialogue ${d.id}: answer out of range`);
    if (new Set(d.options.map((o) => o.english)).size !== d.options.length) problems.push(`dialogue ${d.id}: duplicate options`);
  }
  const category = (id: string) => c.wordById.get(id)?.category;
  for (const p of c.players) {
    if (category(p.position) !== 'positions') problems.push(`player ${p.id}: position ${p.position} is not a position word`);
    if (category(p.number) !== 'numbers') problems.push(`player ${p.id}: number ${p.number} is not a number word`);
    if (category(p.colour) !== 'colours') problems.push(`player ${p.id}: colour ${p.colour} is not a colour word`);
    if (category(p.trait) !== 'describing') problems.push(`player ${p.id}: trait ${p.trait} is not a describing word`);
  }
  for (const b of c.balls) {
    if (b.achievement && !c.achievements.some((a) => a.id === b.achievement)) problems.push(`ball ${b.id}: unknown achievement ${b.achievement}`);
  }
  if (!c.kits.some((k) => k.level <= 1)) problems.push('no starter kit');
  if (!c.balls.some((b) => b.achievement === null)) problems.push('no starter ball');
  if (!c.stadiums.some((s) => s.words === 0)) problems.push('no starter stadium');
  return problems;
}

export const content: Content = makeContent(
  wordsJson as Word[],
  sentencesJson as Sentence[],
  missionsJson as Mission[],
  levelsJson as Level[],
  {
    players: playersJson as ClubPlayer[],
    kits: clubJson.kits as Kit[],
    balls: clubJson.balls as BallSkin[],
    stadiums: clubJson.stadiums as Stadium[],
    rivals: clubJson.rivals as Rival[],
    achievements: achievementsJson as Achievement[],
    dialogues: dialoguesJson as Dialogue[],
    categories: categoriesJson as Record<string, string>,
  },
);
