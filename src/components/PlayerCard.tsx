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
/** Shirt for a card without a colour fact (goalkeepers, striped national kits). */
const NEUTRAL = { main: '#93a6c2', trim: '#08111f' };
const POSITION_CODE: Record<string, string> = { goalkeeper: 'GK', defender: 'DF', midfielder: 'MF', striker: 'ST' };

const TIER_LOOK: Record<ClubPlayer['tier'], string> = {
  1: 'from-[#e0a070] to-[#8a5632] text-night',
  2: 'from-[#e3e9f2] to-[#8e9bb0] text-night',
  3: 'from-[#ffe08a] to-[#c8922a] text-night',
};

export function PlayerCard({ player, content, size = 'sm' }: { player: ClubPlayer; content: Content; size?: 'sm' | 'lg' }) {
  const shirt = (player.colour && SHIRT_COLOURS[player.colour]) || NEUTRAL;
  const digit = player.number ? (content.wordById.get(player.number)?.image ?? '') : '';
  const position = content.wordById.get(player.position)?.english ?? '';
  const large = size === 'lg';
  // Long words get a smaller size instead of breaking mid-word.
  const nameSize = large ? 'text-xl' : player.short.length > 8 ? 'text-[11px]' : 'text-[13px]';
  const countrySize = large ? 'text-sm' : player.country.length > 9 ? 'text-[8px]' : 'text-[10px]';
  return (
    <div className={`flex flex-col items-center rounded-2xl bg-gradient-to-b p-2 text-center shadow-lg ${TIER_LOOK[player.tier]} ${large ? 'w-48 gap-1 p-4' : 'w-full'}`}>
      <div className="flex w-full items-start justify-between">
        <span className={`display leading-none ${large ? 'text-3xl' : 'text-xl'}`}>{POSITION_CODE[player.position] ?? ''}</span>
        <span className={`pl-1 text-right font-semibold leading-none ${countrySize}`}>{player.country}</span>
      </div>
      <Jersey main={shirt.main} trim={shirt.trim} number={digit} size={large ? 96 : 52} label={digit ? `Футболка, номер ${digit}` : 'Футболка'} />
      <span className={`display w-full whitespace-nowrap not-italic leading-tight ${nameSize}`}>{large ? player.name : player.short}</span>
      <span className={`w-full truncate font-semibold lowercase ${large ? 'text-base' : 'text-[11px]'}`}>{position}</span>
    </div>
  );
}
