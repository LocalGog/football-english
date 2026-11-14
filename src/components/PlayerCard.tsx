import type { ClubPlayer, Content } from '../lib/types';
import { Jersey } from './Avatar';

const SHIRT_COLOURS: Record<string, { main: string; trim: string }> = {
  red: { main: '#e5383b', trim: '#f2f6fb' },
  blue: { main: '#2f6fed', trim: '#f2f6fb' },
  green: { main: '#1c9a55', trim: '#f2f6fb' },
  yellow: { main: '#ffd23d', trim: '#08111f' },
  white: { main: '#f2f6fb', trim: '#08111f' },
  black: { main: '#1b2230', trim: '#f2f6fb' },
};
const POSITION_CODE: Record<string, string> = { goalkeeper: 'GK', defender: 'DF', midfielder: 'MF', striker: 'ST' };

/** Card tier by rating: bronze, silver, gold. */
function tier(rating: number): string {
  if (rating >= 80) return 'from-[#ffe08a] to-[#c8922a] text-night';
  if (rating >= 70) return 'from-[#e3e9f2] to-[#8e9bb0] text-night';
  return 'from-[#e0a070] to-[#8a5632] text-night';
}

export function PlayerCard({ player, content, size = 'sm' }: { player: ClubPlayer; content: Content; size?: 'sm' | 'lg' }) {
  const shirt = SHIRT_COLOURS[player.colour] ?? SHIRT_COLOURS.white;
  const digit = content.wordById.get(player.number)?.image ?? '';
  const position = content.wordById.get(player.position)?.english ?? '';
  const large = size === 'lg';
  return (
    <div className={`flex flex-col items-center rounded-2xl bg-gradient-to-b p-2 text-center shadow-lg ${tier(player.rating)} ${large ? 'w-48 gap-1 p-4' : 'w-full'}`}>
      <div className="flex w-full items-start justify-between">
        <span className={`display leading-none ${large ? 'text-4xl' : 'text-2xl'}`}>{player.rating}</span>
        <span className={`display leading-none ${large ? 'text-xl' : 'text-sm'}`}>{POSITION_CODE[player.position] ?? ''}</span>
      </div>
      <Jersey main={shirt.main} trim={shirt.trim} number={digit} size={large ? 96 : 52} label={`Футболка, номер ${digit}`} />
      <span className={`display w-full truncate not-italic leading-tight ${large ? 'text-xl' : 'text-sm'}`}>{player.name}</span>
      <span className={`w-full truncate font-semibold lowercase ${large ? 'text-base' : 'text-[11px]'}`}>{position}</span>
    </div>
  );
}
