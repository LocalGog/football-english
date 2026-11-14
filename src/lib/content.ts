import wordsJson from '../content/words.json';
import sentencesJson from '../content/sentences.json';
import missionsJson from '../content/missions.json';
import type { Content, Mission, Sentence, Word } from './types';

export function makeContent(words: Word[], sentences: Sentence[], missions: Mission[]): Content {
  return {
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
  for (const w of c.words) {
    if (!w.english.trim() || !w.ukrainian.trim() || !w.image.trim()) problems.push(`word ${w.id}: empty field`);
  }
  for (const s of c.sentences) {
    if (s.english.trim().split(/\s+/).length < 2) problems.push(`sentence ${s.id}: needs at least 2 words`);
  }
  for (const m of c.missions) {
    if (m.words.length < 4) problems.push(`mission ${m.id}: needs at least 4 words`);
    for (const id of m.words) if (!c.wordById.has(id)) problems.push(`mission ${m.id}: unknown word ${id}`);
    for (const id of m.sentences) if (!c.sentenceById.has(id)) problems.push(`mission ${m.id}: unknown sentence ${id}`);
  }
  return problems;
}

export const content: Content = makeContent(wordsJson as Word[], sentencesJson as Sentence[], missionsJson as Mission[]);
