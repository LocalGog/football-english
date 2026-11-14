import { Check, Lock, Play as PlayIcon } from 'lucide-react';
import { playTarget } from '../lib/progress';
import type { Content, Mission, Progress } from '../lib/types';

interface Props {
  content: Content;
  progress: Progress;
  onPlay: (mission: Mission | null) => void;
}

/** Fixture list: every match of every season. Played matches can be replayed. */
export function PlayScreen({ content, progress, onPlay }: Props) {
  const target = playTarget(content, progress);
  const upcoming = target.kind === 'mission' ? target.mission : null;
  const gate = target.kind === 'review' && target.reason === 'gate' ? target : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      {content.levels.map((level) => (
        <section key={level.level}>
          <h2 className="display mb-2 text-xl">
            Сезон {level.level} · {level.title}
          </h2>
          {gate?.level === level.level && (
            <div className="mb-2 rounded-2xl border border-gold/60 bg-gold/10 p-3 text-sm">
              <p>Сезон відкриється, коли вивчиш ще {gate.missing} сл. з попередніх матчів.</p>
              <button className="display mt-2 h-11 w-full rounded-xl bg-gold text-base text-night" onClick={() => onPlay(null)}>
                Тренувальний матч
              </button>
            </div>
          )}
          <ol className="flex flex-col gap-2">
            {content.missions.map((m, i) => {
              if (m.level !== level.level) return null;
              const done = (progress.missions[m.id]?.completed ?? 0) > 0;
              const scored = (progress.missions[m.id]?.goals ?? 0) > 0;
              const isNext = upcoming?.id === m.id;
              const body = (
                <>
                  <span className={`display w-8 text-center text-xl tabular-nums ${isNext ? 'text-gold' : 'text-mute'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="display block truncate text-lg not-italic">{m.title}</span>
                    <span className="block truncate text-sm text-mute">{m.description}</span>
                  </span>
                  {done ? (
                    <span className="flex items-center gap-1 text-sm font-semibold text-pitch">
                      {scored ? '1:0' : '0:0'} <Check size={20} aria-label="Зіграно" />
                    </span>
                  ) : isNext ? (
                    <PlayIcon size={20} className="text-gold" fill="currentColor" aria-label="Наступний матч" />
                  ) : (
                    <Lock size={18} className="text-mute" aria-label="Відкриється після попереднього матчу" />
                  )}
                </>
              );
              const base = 'flex w-full items-center gap-3 rounded-2xl border px-3 py-3';
              return (
                <li key={m.id}>
                  {done || isNext ? (
                    <button className={`${base} bg-panel ${isNext ? 'border-gold' : 'border-line'}`} onClick={() => onPlay(m)} data-mission={m.id}>
                      {body}
                    </button>
                  ) : (
                    <div className={`${base} border-line/60 opacity-60`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </main>
  );
}
