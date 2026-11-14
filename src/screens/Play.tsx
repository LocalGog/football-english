import { Check, Lock, Mic, Play as PlayIcon, RefreshCw, Target } from 'lucide-react';
import { SPEAK_MIN_WORDS } from '../lib/engine';
import { playTarget } from '../lib/progress';
import { hardWordIds } from '../lib/srs';
import type { Content, Mission, Progress } from '../lib/types';

interface Props {
  content: Content;
  progress: Progress;
  onPlay: (mission: Mission | null) => void;
  onWeak: () => void;
  onSpeak: () => void;
}

/** A weak-words match needs enough words to fill the answer options. */
const WEAK_MIN_WORDS = 3;

/** Fixture list: every match of every season. Played matches can be replayed. */
export function PlayScreen({ content, progress, onPlay, onWeak, onSpeak }: Props) {
  const target = playTarget(content, progress);
  const upcoming = target.kind === 'mission' ? target.mission : null;
  const gate = target.kind === 'review' && target.reason === 'gate' ? target : null;
  const seen = Object.keys(progress.words).length;
  const hard = hardWordIds(progress).length;
  const drill = 'flex w-full items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-3 text-left';

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <section>
        <h2 className="display mb-2 text-xl">Training</h2>
        {seen < SPEAK_MIN_WORDS ? (
          <p className="rounded-2xl border border-dashed border-line p-3 text-sm text-mute">Тренування відкриються після першого матчу.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <li>
              <button className={drill} onClick={onSpeak} data-drill="speak">
                <Mic size={22} className="shrink-0 text-gold" />
                <span className="min-w-0 flex-1">
                  <span className="display block text-lg not-italic">Say it</span>
                  <span className="block text-sm text-mute">Вимова: послухай, скажи, порівняй</span>
                </span>
              </button>
            </li>
            {hard >= WEAK_MIN_WORDS && (
              <li>
                <button className={drill} onClick={onWeak} data-drill="weak">
                  <Target size={22} className="shrink-0 text-miss" />
                  <span className="min-w-0 flex-1">
                    <span className="display block text-lg not-italic">Weak words</span>
                    <span className="block text-sm text-mute">Слова, які поки не даються: {hard}</span>
                  </span>
                </button>
              </li>
            )}
            <li>
              <button className={drill} onClick={() => onPlay(null)} data-drill="review">
                <RefreshCw size={22} className="shrink-0 text-pitch" />
                <span className="min-w-0 flex-1">
                  <span className="display block text-lg not-italic">Review match</span>
                  <span className="block text-sm text-mute">Повторення слів, яким настав час</span>
                </span>
              </button>
            </li>
          </ul>
        )}
      </section>
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
