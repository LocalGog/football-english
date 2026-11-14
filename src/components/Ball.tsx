import type { BallSkin } from '../lib/types';

/** Match ball in the chosen skin. */
export function Ball({ skin, size = 28 }: { skin: BallSkin; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill={skin.base} stroke={skin.mark} strokeWidth="2.5" />
      <path d="M20 12.5 27 17.6 24.3 25.8H15.7L13 17.6Z" fill={skin.mark} />
      <path d="M20 12.5V3M27 17.6l9-3M24.3 25.8l5.6 7.6M15.7 25.8l-5.6 7.6M13 17.6l-9-3" stroke={skin.mark} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
