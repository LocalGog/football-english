import { ChartColumn, Home, ListOrdered, Lock, Shield, Trophy, type LucideIcon } from 'lucide-react';

export type Tab = 'home' | 'play' | 'club' | 'awards' | 'progress' | 'parent';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'play', label: 'Play', icon: ListOrdered },
  { id: 'club', label: 'My Club', icon: Shield },
  { id: 'awards', label: 'Awards', icon: Trophy },
  { id: 'progress', label: 'Progress', icon: ChartColumn },
  { id: 'parent', label: 'Parents', icon: Lock },
];

export function BottomNav({ tab, onTab, clubBadge }: { tab: Tab; onTab: (t: Tab) => void; clubBadge: number }) {
  return (
    <nav className="grid grid-cols-6 border-t border-line bg-night" aria-label="Розділи">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`relative flex h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-semibold ${tab === id ? 'text-gold' : 'text-mute'}`}
          onClick={() => onTab(id)}
          aria-current={tab === id ? 'page' : undefined}
          data-tab={id}
        >
          <Icon size={22} />
          <span className="max-w-full truncate">{label}</span>
          {id === 'club' && clubBadge > 0 && (
            <span className="absolute right-[calc(50%-20px)] top-2 flex size-5 items-center justify-center rounded-full bg-miss text-[11px] font-bold text-night" aria-label={`Доступно трансферів: ${clubBadge}`}>
              {clubBadge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
