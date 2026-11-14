import { useState } from 'react';
import { Check, Lock, Play, Settings as SettingsIcon } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { SettingsSheet } from '../components/SettingsSheet';
import { goalsTotal, levelInfo, nextMission } from '../lib/progress';
import { learnedCount } from '../lib/srs';
import type { Content, Mission, Progress, Settings } from '../lib/types';

interface Props {
  content: Content;
  progress: Progress;
  onPlay: (mission: Mission | null) => void;
  onSettings: (settings: Settings) => void;
}

export function Home({ content, progress, onPlay, onSettings }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const player = progress.player;
  const lvl = levelInfo(progress.xp);
  const upcoming = nextMission(content.missions, progress);
  const played = content.missions.filter((m) => progress.missions[m.id]?.completed > 0).length;
  const nextStatus = levelInfo(lvl.level * lvl.need).status;

  const tiles = [
    { label: 'Слів вивчено', value: `${learnedCount(progress)}/${content.words.length}` },
    { label: 'Голів', value: String(goalsTotal(progress)) },
    { label: 'Сезон', value: `${played}/${content.missions.length}` },
  ];

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section className="flex items-center gap-4 rounded-3xl border border-line bg-panel p-4">
          <Avatar id={player?.avatar ?? ''} size={72} />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-3xl leading-tight">{player?.name}</p>
            <p className="font-semibold text-gold">{lvl.status}</p>
          </div>
          <button
            className="flex size-11 items-center justify-center rounded-xl border border-line text-mute"
            onClick={() => setSettingsOpen(true)}
            aria-label="Налаштування звуку"
          >
            <SettingsIcon size={22} />
          </button>
        </section>

        <section className="rounded-3xl border border-line bg-panel p-4">
          <div className="flex items-baseline justify-between">
            <p className="display text-xl">Рівень {lvl.level}</p>
            <p className="text-sm font-semibold tabular-nums text-mute">
              {lvl.into} / {lvl.need} XP
            </p>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-night">
            <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-mute">
            Наступна нагорода: статус «{nextStatus}» через {lvl.need - lvl.into} XP
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-line bg-panel px-2 py-3 text-center">
              <p className="display text-2xl tabular-nums text-chalk">{t.value}</p>
              <p className="mt-1 text-xs text-mute">{t.label}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="display mb-2 text-xl">Сезон 1 · Football Starter</h2>
          <ol className="flex flex-col gap-2">
            {content.missions.map((m, i) => {
              const doneCount = progress.missions[m.id]?.completed ?? 0;
              const isNext = upcoming?.id === m.id;
              const body = (
                <>
                  <span className={`display w-8 text-center text-xl tabular-nums ${isNext ? 'text-gold' : 'text-mute'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="display block truncate text-lg not-italic">{m.title}</span>
                    <span className="block truncate text-sm text-mute">{m.description}</span>
                  </span>
                  {doneCount > 0 ? (
                    <Check size={22} className="text-pitch" aria-label="Зіграно" />
                  ) : isNext ? (
                    <Play size={20} className="text-gold" fill="currentColor" aria-label="Наступний матч" />
                  ) : (
                    <Lock size={18} className="text-mute" aria-label="Відкриється після попереднього матчу" />
                  )}
                </>
              );
              const base = 'flex w-full items-center gap-3 rounded-2xl border px-3 py-3';
              return (
                <li key={m.id}>
                  {doneCount > 0 || isNext ? (
                    <button className={`${base} bg-panel ${isNext ? 'border-gold' : 'border-line'}`} onClick={() => onPlay(m)}>
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
      </main>

      <footer className="border-t border-line bg-night/95 p-4">
        <button
          className="display flex h-18 w-full flex-col items-center justify-center rounded-2xl bg-gold py-3 text-night active:scale-[0.98]"
          onClick={() => onPlay(upcoming)}
        >
          <span className="flex items-center gap-2 text-3xl leading-none">
            <Play size={26} fill="currentColor" /> Play now
          </span>
          <span className="mt-1 text-sm font-semibold not-italic normal-case">
            {upcoming ? `Матч ${content.missions.indexOf(upcoming) + 1} · ${upcoming.title}` : 'Тренувальний матч на повторення'}
          </span>
        </button>
      </footer>

      {settingsOpen && <SettingsSheet settings={progress.settings} onChange={onSettings} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
