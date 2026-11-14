import { Lock, Trophy } from 'lucide-react';
import { metricValue } from '../lib/club';
import type { Content, Progress } from '../lib/types';
import { Ball } from '../components/Ball';

export function AwardsScreen({ content, progress }: { content: Content; progress: Progress }) {
  const done = content.achievements.filter((a) => a.id in progress.achievements).length;
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="display text-3xl">Achievements</h1>
        <p className="display text-xl tabular-nums text-gold">
          {done}/{content.achievements.length}
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {content.achievements.map((a) => {
          const unlocked = a.id in progress.achievements;
          const value = Math.min(metricValue(a.metric, content, progress), a.target);
          const prize = content.balls.find((b) => b.achievement === a.id);
          return (
            <li
              key={a.id}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${unlocked ? 'border-gold bg-gold/10' : 'border-line bg-panel'}`}
              data-achievement={a.id}
              data-unlocked={unlocked}
            >
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${unlocked ? 'bg-gold text-night' : 'bg-night text-mute'}`}>
                {unlocked ? <Trophy size={24} /> : <Lock size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="display text-lg not-italic leading-tight">{a.title}</p>
                <p className="text-sm text-mute">{a.description}</p>
                {!unlocked && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-night">
                      <div className="h-full rounded-full bg-pitch" style={{ width: `${(value / a.target) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-mute">
                      {value}/{a.target}
                    </span>
                  </div>
                )}
              </div>
              {prize && (
                <span className={`flex shrink-0 flex-col items-center gap-1 text-[11px] text-mute ${unlocked ? '' : 'opacity-50'}`}>
                  <Ball skin={prize} size={30} />
                  м'яч
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
