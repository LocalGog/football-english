import { useMemo, useState } from 'react';
import { ArrowRight, Volume2, X } from 'lucide-react';
import { PlayerCard } from '../components/PlayerCard';
import { WordImage } from '../components/WordImage';
import { buildScout, scoutReport } from '../lib/club';
import { speak } from '../lib/speech';
import type { ClubPlayer, Content, Progress } from '../lib/types';

interface Props {
  player: ClubPlayer;
  content: Content;
  progress: Progress;
  onAnswer: (wordId: string, correct: boolean) => void;
  onSigned: (playerId: string) => void;
  onClose: () => void;
}

type Stage = 'quiz' | 'signed' | 'failed';

/** Football Manager task: read the scout's report in English and answer questions to sign the player. */
export function ScoutScreen({ player, content, progress, onAnswer, onSigned, onClose }: Props) {
  const [attempt, setAttempt] = useState(0);
  // Built once per attempt: the answers given along the way must not reshuffle the questions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => buildScout(player, content, progress), [player, attempt]);
  const report = useMemo(() => scoutReport(player, content), [player, content]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('quiz');
  const q = questions[index];
  const say = (text: string) => speak(text, progress.settings);

  const choose = (id: string) => {
    if (chosen !== null) return;
    setChosen(id);
    const correct = id === q.wordId;
    onAnswer(q.wordId, correct);
    if (!correct) say(content.wordById.get(q.wordId)?.english ?? '');
  };

  const next = () => {
    const correct = chosen === q.wordId;
    setChosen(null);
    if (!correct) return setStage('failed');
    if (index + 1 < questions.length) return setIndex(index + 1);
    onSigned(player.id);
    setStage('signed');
  };

  const retry = () => {
    setAttempt((a) => a + 1);
    setIndex(0);
    setStage('quiz');
  };

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <header className="flex items-center gap-3 px-4 pt-4">
        <button className="flex size-11 items-center justify-center rounded-xl border border-line bg-panel text-mute" onClick={onClose} aria-label="Закрити трансфер">
          <X size={22} />
        </button>
        <p className="display flex-1 text-lg">Transfer</p>
        {stage === 'quiz' && (
          <p className="display text-lg tabular-nums text-gold">
            {index + 1}/{questions.length}
          </p>
        )}
      </header>

      {stage === 'quiz' && (
        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section className="rounded-2xl border-2 border-gold/60 bg-panel p-4" data-scout-player={player.id}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-widest text-mute">Scout report</p>
              <button className="flex size-11 items-center justify-center rounded-full bg-gold text-night" onClick={() => say(report.join(' '))} aria-label="Послухати звіт">
                <Volume2 size={22} />
              </button>
            </div>
            <ul className="mt-1 flex flex-col gap-0.5 text-lg font-semibold">
              {report.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="text-center" data-scout-question={q.key}>
            <p className="display text-2xl not-italic normal-case">{q.english}</p>
            <p className="text-sm text-mute">{q.ukrainian}</p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            {q.options.map((id) => {
              const w = content.wordById.get(id);
              if (!w) return null;
              const state = chosen === null ? 'idle' : id === q.wordId ? 'right' : id === chosen ? 'wrong' : 'dim';
              const look = {
                idle: 'border-line bg-panel active:scale-95',
                right: 'border-pitch bg-pitch/25',
                wrong: 'anim-shake border-miss bg-miss/20',
                dim: 'border-line bg-panel opacity-40',
              }[state];
              return (
                <button
                  key={id}
                  className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 transition ${look}`}
                  onClick={() => choose(id)}
                  disabled={chosen !== null}
                  data-option={id}
                >
                  <WordImage word={w} className="text-4xl" />
                  <span className="text-base font-semibold leading-tight">{w.ukrainian}</span>
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <button className="display sticky bottom-0 flex h-16 shrink-0 items-center justify-center gap-2 rounded-2xl bg-chalk text-2xl text-night" onClick={next} data-scout-next>
              Далі <ArrowRight size={24} />
            </button>
          )}
        </main>
      )}

      {stage === 'signed' && (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center" data-scout-result="signed">
          <p className="display anim-pop text-5xl text-gold">Signed!</p>
          <div className="anim-pop">
            <PlayerCard player={player} content={content} size="lg" />
          </div>
          <p className="text-lg">{player.name} тепер у твоєму клубі.</p>
          <button className="display h-16 w-full rounded-2xl bg-gold text-2xl text-night" onClick={onClose}>
            До клубу
          </button>
        </main>
      )}

      {stage === 'failed' && (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center" data-scout-result="failed">
          <p className="display text-4xl text-miss">Майже домовилися</p>
          <p className="text-lg">Трансфер не згорів. Перечитай звіт скаута і спробуй ще раз.</p>
          <button className="display h-16 w-full rounded-2xl bg-gold text-2xl text-night" onClick={retry}>
            Ще раз
          </button>
          <button className="h-12 w-full rounded-2xl border-2 border-line font-semibold text-chalk" onClick={onClose}>
            До клубу
          </button>
        </main>
      )}
    </div>
  );
}
