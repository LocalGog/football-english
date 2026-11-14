export const AVATARS = [
  { id: 'gold', main: '#ffc83d', trim: '#08111f' },
  { id: 'red', main: '#e5383b', trim: '#f2f6fb' },
  { id: 'blue', main: '#2f6fed', trim: '#f2f6fb' },
  { id: 'green', main: '#1c9a55', trim: '#ffc83d' },
  { id: 'white', main: '#f2f6fb', trim: '#08111f' },
  { id: 'purple', main: '#7b3fe4', trim: '#ffc83d' },
] as const;

export const DEFAULT_AVATAR = AVATARS[0].id;

/** The player's shirt with number 10. */
export function Avatar({ id, size = 64 }: { id: string; size?: number }) {
  const kit = AVATARS.find((a) => a.id === id) ?? AVATARS[0];
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label="Форма гравця">
      <path
        d="M20 10 32 4q8 8 16 0l12 6 14 14-12 10-6-6v44H24V28l-6 6L6 24Z"
        fill={kit.main}
        stroke={kit.trim}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text x="40" y="56" textAnchor="middle" fontSize="24" fontWeight="900" fontStyle="italic" fill={kit.trim} fontFamily="Arial Narrow, Arial, sans-serif">
        10
      </text>
    </svg>
  );
}
