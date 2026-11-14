import { ArrowRight, Home as HomeIcon, Volume2 } from 'lucide-react';
import type { MatchPlan } from '../lib/engine';
import { levelInfo } from '../lib/progress';
import { speak } from '../lib/speech';
import type { Content, MatchResult, Progress } from '../lib/types';
import { WordImage } from '../components/WordImage';

interface Props {
  content: Content;
  progress: Progress;
  plan: MatchPlan;
  result: MatchResult;
  xpBefore: number;
  onNext: () => void;
  onHome: () => void;
}

export function Result({ content, progress, plan, result, xpBefore, onNext, onHome }: Props) {
  const before = levelInfo(xpBefore);
  const after = levelInfo(progress.xp);
  const wordIds = [...new Set(plan.steps.flatMap((s) => (s.kind === 'pick' && !s.shot ? [s.wordId] : [])))];

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section className="anim-rise rounded-3xl border-2 border-gold/60 bg-gradient-to-b from-panel to-night p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-mute">Фінальний свисток</p>
          <p className="display mt-2 text-6xl leading-none text-gold">{result.goal ? 'Goal! 1:0' : '0:0'}</p>
          <p className="mt-2 text-lg font-semibold">{result.goal ? 'Перемога! Ти забив вирішальний гол.' : 'Гарна гра. Гол буде в наступному матчі.'}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-night/70 py-3">
              <p className="display text-3xl tabular-nums">+{result.xp}</p>
              <p className="text-xs text-mute">XP</p>
            </div>
            <div className="rounded-2xl bg-night/70 py-3">
              <p className="display text-3xl tabular-nums">
                {result.correct}/{result.total}
              </p>
              <p className="text-xs text-mute">З першої спроби</p>
            </div>
          </div>
          {after.level > before.level && (
            <p className="display anim-pop mt-4 rounded-2xl bg-gold px-3 py-3 text-xl text-night">
              Рівень {after.level}! Новий статус: {after.status}
            </p>
          )}
        </section>

        <section>
          <h2 className="display mb-2 text-xl">Слова цього матчу</h2>
          <ul className="grid grid-cols-2 gap-2">
            {wordIds.map((id) => {
              const w = content.wordById.get(id);
              if (!w) return null;
              return (
                <li key={id}>
                  <button
                    className="flex w-full items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2 text-left"
                    onClick={() => speak(w.english, progress.settings)}
                    aria-label={`Послухати ${w.english}`}
                  >
                    <WordImage word={w} className="w-9 text-center text-2xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{w.english}</span>
                      <span className="block truncate text-sm text-mute">{w.ukrainian}</span>
                    </span>
                    <Volume2 size={18} className="shrink-0 text-mute" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="flex gap-3 border-t border-line bg-night/95 p-4">
        <button className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-panel text-chalk" onClick={onHome} aria-label="На базу">
          <HomeIcon size={26} />
        </button>
        <button className="display flex h-16 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gold text-xl text-night" onClick={onNext}>
          Наступний матч <ArrowRight size={24} />
        </button>
      </footer>
    </div>
  );
}
