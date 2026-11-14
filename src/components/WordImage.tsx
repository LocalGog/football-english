import type { Word } from '../lib/types';

/** Vocabulary picture. Digits and other plain glyphs get the scoreboard face; emoji render as they are. */
export function WordImage({ word, className = '' }: { word: Word; className?: string }) {
  const plain = /^[\w ]+$/.test(word.image);
  return (
    <span className={`${plain ? 'display text-gold' : ''} leading-none ${className}`} aria-hidden="true">
      {word.image}
    </span>
  );
}
