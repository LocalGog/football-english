import { Check, Lock, UserPlus } from 'lucide-react';
import { Jersey } from '../components/Avatar';
import { Ball } from '../components/Ball';
import { PlayerCard } from '../components/PlayerCard';
import {
  ballUnlocked, clubName, currentBall, currentSeason, currentStadium, kitUnlocked, leagueTable, nextScoutPlayer, stadiumUnlocked,
} from '../lib/club';
import { speak } from '../lib/speech';
import type { Content, Progress } from '../lib/types';

interface Props {
  content: Content;
  progress: Progress;
  onScout: () => void;
  onKit: (id: string) => void;
  onBall: (id: string) => void;
  onStadium: (id: string) => void;
}

export function ClubScreen({ content, progress, onScout, onKit, onBall, onStadium }: Props) {
  const squad = progress.club.cards.flatMap((id) => content.players.find((p) => p.id === id) ?? []);
  const rating = squad.length ? Math.round(squad.reduce((s, p) => s + p.rating, 0) / squad.length) : 0;
  const season = currentSeason(content, progress);
  const table = leagueTable(content, progress, season, clubName(progress));
  const candidate = nextScoutPlayer(content, progress);
  const tokens = progress.club.tokens;
  const allSigned = squad.length === content.players.length;
  const ball = currentBall(content, progress);
  const stadium = currentStadium(content, progress);
  const word = (id: string) => content.wordById.get(id)?.english ?? '';
  const option = (active: boolean, open: boolean) =>
    `relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 text-center ${active ? 'border-gold bg-gold/10' : 'border-line bg-panel'} ${open ? '' : 'opacity-50'}`;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <header className="rounded-3xl border border-line bg-panel p-4">
        <h1 className="display truncate text-3xl">{clubName(progress)}</h1>
        <p className="text-sm text-mute">
          {stadium.name} · гравців {squad.length}/{content.players.length}
          {rating > 0 && ` · рейтинг ${rating}`}
        </p>
      </header>

      <section>
        <h2 className="display mb-2 text-xl">Transfers</h2>
        <div className="rounded-2xl border border-line bg-panel p-3">
          {allSigned ? (
            <p className="text-sm text-mute">Усі гравці вже у твоєму клубі.</p>
          ) : !candidate ? (
            <p className="text-sm text-mute">Скаут почне роботу, коли пройдеш матч «Positions» і знатимеш позиції гравців.</p>
          ) : tokens > 0 ? (
            <>
              <p className="text-sm">
                Доступно трансферів: <b className="text-gold">{tokens}</b>. Прочитай звіт скаута англійською та підпиши гравця.
              </p>
              <button className="display mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold text-xl text-night" onClick={onScout} data-scout>
                <UserPlus size={22} /> Знайти гравця
              </button>
            </>
          ) : (
            <p className="text-sm text-mute">Трансферів немає. Кожен гол у матчі дає один трансфер.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="display mb-2 text-xl">Squad</h2>
        {squad.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-mute">Склад порожній. Перший гравець прийде після трансферу.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {squad.map((p) => (
              <li key={p.id}>
                <button
                  className="w-full active:scale-95"
                  onClick={() => speak(`${p.name}. ${word(p.position)}. Number ${word(p.number)}.`, progress.settings)}
                  aria-label={`Послухати про гравця ${p.name}`}
                  data-card={p.id}
                >
                  <PlayerCard player={p} content={content} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="display mb-2 text-xl">League table · сезон {season}</h2>
        <table className="w-full overflow-hidden rounded-2xl border border-line text-sm">
          <thead className="bg-panel text-left text-xs uppercase text-mute">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Club</th>
              <th className="w-10 px-2 py-2 text-right" title="Played">P</th>
              <th className="w-12 px-2 py-2 text-right" title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={row.id} className={row.mine ? 'bg-gold/15 font-bold text-gold' : 'border-t border-line/60'} data-mine={row.mine}>
                <td className="px-2 py-2 tabular-nums">{i + 1}</td>
                <td className="max-w-0 truncate px-2 py-2">{row.name}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.played}</td>
                <td className="px-2 py-2 text-right tabular-nums">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-mute">Матч із голом — 3 очки, без гола — 1. Переграй матч, щоб покращити результат.</p>
      </section>

      <section>
        <h2 className="display mb-2 text-xl">Kit</h2>
        <ul className="grid grid-cols-4 gap-2">
          {content.kits.map((k) => {
            const open = kitUnlocked(k, progress);
            const active = progress.player?.avatar === k.id;
            const inner = (
              <>
                <Jersey {...k} size={48} label={`Форма ${k.id}`} />
                <span className="text-[11px] text-mute">{open ? (active ? 'обрано' : 'обрати') : `рівень ${k.level}`}</span>
                {active && <Check size={16} className="absolute right-1 top-1 text-gold" />}
                {!open && <Lock size={14} className="absolute right-1 top-1 text-mute" />}
              </>
            );
            return (
              <li key={k.id}>
                {open ? (
                  <button className={`${option(active, true)} w-full`} onClick={() => onKit(k.id)} aria-pressed={active} data-kit={k.id}>
                    {inner}
                  </button>
                ) : (
                  <div className={option(false, false)}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="display mb-2 text-xl">Ball</h2>
        <ul className="grid grid-cols-3 gap-2">
          {content.balls.map((b) => {
            const open = ballUnlocked(b, progress);
            const active = ball.id === b.id;
            const need = content.achievements.find((a) => a.id === b.achievement)?.title;
            const inner = (
              <>
                <Ball skin={b} size={40} />
                <span className="text-sm font-semibold">{b.name}</span>
                <span className="text-[11px] leading-tight text-mute">{open ? (active ? 'обрано' : 'обрати') : need}</span>
                {!open && <Lock size={14} className="absolute right-1 top-1 text-mute" />}
              </>
            );
            return (
              <li key={b.id}>
                {open ? (
                  <button className={`${option(active, true)} w-full`} onClick={() => onBall(b.id)} aria-pressed={active} data-ball={b.id}>
                    {inner}
                  </button>
                ) : (
                  <div className={option(false, false)}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="display mb-2 text-xl">Stadium</h2>
        <ul className="flex flex-col gap-2">
          {content.stadiums.map((s) => {
            const open = stadiumUnlocked(s, progress);
            const active = stadium.id === s.id;
            const inner = (
              <>
                <span
                  className="h-10 w-16 shrink-0 rounded-lg border-2 border-chalk/70"
                  style={{ background: `repeating-linear-gradient(90deg, ${s.light} 0 25%, ${s.dark} 25% 50%)` }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 text-left">
                  <span className="display block truncate text-lg not-italic">{s.name}</span>
                  <span className="block truncate text-sm text-mute">{open ? s.description : `Відкриється за ${s.words} вивчених слів`}</span>
                </span>
                {active ? <Check size={20} className="text-gold" /> : !open && <Lock size={18} className="text-mute" />}
              </>
            );
            const row = `flex w-full items-center gap-3 rounded-2xl border-2 p-3 ${active ? 'border-gold bg-gold/10' : 'border-line bg-panel'}`;
            return (
              <li key={s.id}>
                {open ? (
                  <button className={row} onClick={() => onStadium(s.id)} aria-pressed={active} data-stadium={s.id}>
                    {inner}
                  </button>
                ) : (
                  <div className={`${row} opacity-50`}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
