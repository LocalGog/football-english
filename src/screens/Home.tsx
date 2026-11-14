import { useState } from 'react';
import { Play, Settings as SettingsIcon } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { SettingsSheet } from '../components/SettingsSheet';
import { clubName, currentSeason, currentStadium, leagueTable, stadiumUnlocked } from '../lib/club';
import { goalsTotal, levelInfo, playTarget } from '../lib/progress';
import { todayMinutes } from '../lib/stats';
import { learnedCount } from '../lib/srs';
import type { Content, Mission, Progress, Settings } from '../lib/types';

interface Props {
  content: Content;
  progress: Progress;
  onPlay: (mission: Mission | null) => void;
  onSettings: (settings: Settings) => void;
  now: number;
}

/** The player's base: who you are, how far you have come, and one big button. */
export function Home({ content, progress, onPlay, onSettings, now }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const player = progress.player;
  const lvl = levelInfo(progress.xp);
  const target = playTarget(content, progress);
  const upcoming = target.kind === 'mission' ? target.mission : null;
  const learned = learnedCount(progress);
  const season = currentSeason(content, progress);
  const table = leagueTable(content, progress, season, clubName(progress));
  const place = table.findIndex((r) => r.mine) + 1;
  const nextKit = content.kits.find((k) => k.level > lvl.level);
  const nextStadium = content.stadiums.find((s) => !stadiumUnlocked(s, progress));
  const minutes = todayMinutes(progress, now);
  const goal = progress.parent.dailyMinutes;

  const tiles = [
    { label: `Слів із ${content.words.length}`, value: String(learned) },
    { label: 'Голів', value: String(goalsTotal(progress)) },
    { label: 'Місце в лізі', value: `${place}/${table.length}` },
  ];

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section className="flex items-center gap-4 rounded-3xl border border-line bg-panel p-4">
          <Avatar id={player?.avatar ?? ''} size={72} />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-3xl leading-tight">{player?.name}</p>
            <p className="font-semibold text-gold">{lvl.status}</p>
            <p className="truncate text-sm text-mute">
              {clubName(progress)} · {currentStadium(content, progress).name}
            </p>
          </div>
          <button
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-mute"
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
          <p className="mt-3 text-sm text-mute" data-today>
            Сьогодні: <b className="tabular-nums text-chalk">{minutes}</b> з {goal} хв
            {minutes >= goal && ' · норму виконано'}
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

        <section className="rounded-3xl border border-line bg-panel p-4">
          <h2 className="display text-xl">Наступні нагороди</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-mute">
            {nextKit && (
              <li>
                Нова форма на рівні {nextKit.level}: ще {(nextKit.level - 1) * lvl.need - progress.xp} XP
              </li>
            )}
            {nextStadium && (
              <li>
                Стадіон «{nextStadium.name}»: ще {nextStadium.words - learned} сл.
              </li>
            )}
            <li>Гол у матчі дає трансфер нового гравця в клуб</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-line bg-night/95 p-4">
        <button
          className="display flex w-full flex-col items-center justify-center rounded-2xl bg-gold py-3 text-night active:scale-[0.98]"
          onClick={() => onPlay(upcoming)}
          data-play-now
        >
          <span className="flex items-center gap-2 text-3xl leading-none">
            <Play size={26} fill="currentColor" /> Play now
          </span>
          <span className="mt-1 text-sm font-semibold not-italic normal-case">
            {upcoming
              ? `Матч ${content.missions.indexOf(upcoming) + 1} · ${upcoming.title}`
              : target.kind === 'review' && target.reason === 'gate'
                ? `Тренувальний матч · шлях до сезону ${target.level}`
                : 'Тренувальний матч на повторення'}
          </span>
        </button>
      </footer>

      {settingsOpen && (
        <SettingsSheet progress={progress} onChange={onSettings} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
