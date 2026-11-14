import { useId } from 'react';
import { content } from '../lib/content';
import type { Kit } from '../lib/types';

const SHIRT = 'M20 10 32 4q8 8 16 0l12 6 14 14-12 10-6-6v44H24V28l-6 6L6 24Z';

interface JerseyProps {
  main: string;
  trim: string;
  accent?: string;
  pattern?: Kit['pattern'];
  number?: string;
  size?: number;
  label?: string;
}

/** A football shirt. Patterns are drawn inside the shirt outline. */
export function Jersey({ main, trim, accent, pattern = 'plain', number = '10', size = 64, label = 'Футболка' }: JerseyProps) {
  const clip = useId();
  const second = accent ?? trim;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={label}>
      <clipPath id={clip}>
        <path d={SHIRT} />
      </clipPath>
      <path d={SHIRT} fill={main} />
      <g clipPath={`url(#${clip})`} fill={second}>
        {pattern === 'stripes' && [14, 30, 46, 62].map((x) => <rect key={x} x={x} y="0" width="8" height="80" />)}
        {pattern === 'hoops' && [14, 32, 50, 68].map((y) => <rect key={y} x="0" y={y} width="80" height="8" />)}
        {pattern === 'sash' && <path d="M14 0h14l44 80H58Z" />}
      </g>
      <path d={SHIRT} fill="none" stroke={trim} strokeWidth="3" strokeLinejoin="round" />
      <text
        x="40" y="56" textAnchor="middle" fontSize="24" fontWeight="900" fontStyle="italic"
        fill={trim} stroke={main} strokeWidth="3" paintOrder="stroke" fontFamily="Arial Narrow, Arial, sans-serif"
      >
        {number}
      </text>
    </svg>
  );
}

/** The player's own kit, by kit id. */
export function Avatar({ id, size = 64 }: { id: string; size?: number }) {
  const kit = content.kits.find((k) => k.id === id) ?? content.kits[0];
  return <Jersey {...kit} size={size} label="Форма гравця" />;
}
