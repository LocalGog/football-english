import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Turtle, Volume2, X } from 'lucide-react';
import type { BuildStep, IntroStep, MatchPlan, PickStep, Step } from '../lib/engine';
import { XP_FIRST_TRY, XP_GOAL, XP_RETRY } from '../lib/progress';
import { speak, stopSpeaking, useSpeechStatus, type SpeechStatus } from '../lib/speech';
import type { BallSkin, Content, MatchResult, PickMode, Settings, Stadium, Word } from '../lib/types';
import { Ball } from '../components/Ball';
import { Pitch } from '../components/Pitch';
import { WordImage } from '../components/WordImage';

const SLOW_RATE = 0.55;
const AUTO_NEXT_MS = 1000;
const GOAL_MS = 2200;
const PRAISE = ['Great pass!', 'Nice!', 'Good!', 'Well done!', 'Super!'];

interface Props {
  plan: MatchPlan;
  content: Content;
  settings: Settings;
  ball: BallSkin;
  stadium: Stadium;
  onAnswer: (wordId: string, correct: boolean, mode: PickMode) => void;
  onFinish: (result: MatchResult) => void;
  onExit: () => void;
}

interface Feedback {
  correct: boolean;
  title: string;
  detail?: string;
}

type Say = (text: string, slow?: boolean) => void;

function mustWord(content: Content, id: string): Word {
  const w = content.wordById.get(id);
  if (!w) throw new Error(`Слово «${id}» відсутнє у словнику`);
  return w;
}

export function MissionScreen({ plan, content, settings, ball, stadium, onAnswer, onFinish, onExit }: Props) {
  const [queue, setQueue] = useState<Step[]>(plan.steps);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState({ first: 0, retry: 0 });
  const [goal, setGoal] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const speechStatus = useSpeechStatus();

  const step = queue[idx];
  const say: Say = (text, slow = false) => speak(text, { accent: settings.accent, rate: slow ? SLOW_RATE : settings.rate });

  useEffect(() => stopSpeaking, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish({
      missionId: plan.missionId,
      correct: score.first,
      total: plan.questionCount,
      goal,
      xp: score.first * XP_FIRST_TRY + score.retry * XP_RETRY + (goal ? XP_GOAL : 0) + plan.rewardXp,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
    });
  };

  const advance = () => {
    setFeedback(null);
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else finish();
  };

  // Correct answers keep the match flowing; a miss waits for a tap so the right answer can be read.
  useEffect(() => {
    if (!feedback?.correct) return;
    const t = window.setTimeout(goal ? finish : advance, goal ? GOAL_MS : AUTO_NEXT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  useEffect(() => {
    if (!confirmExit) return;
    const t = window.setTimeout(() => setConfirmExit(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmExit]);

  const answer = (correct: boolean, rightAnswer: string) => {
    if (feedback || step.kind === 'intro') return;
    if (step.kind === 'pick') onAnswer(step.wordId, correct, step.mode);
    if (correct) setScore((s) => (step.retry ? { ...s, retry: s.retry + 1 } : { ...s, first: s.first + 1 }));

    if (step.kind === 'pick' && step.shot) {
      if (correct) {
        setGoal(true);
        setFeedback({ correct: true, title: 'Goal!' });
      } else if (step.key === plan.steps[plan.steps.length - 1].key) {
        setQueue((q) => [...q, plan.spareShot]);
        setFeedback({ correct: false, title: 'Воротар забрав!', detail: `${rightAnswer}. Є ще один удар.` });
      } else {
        setFeedback({ correct: false, title: 'Удар повз ворота', detail: rightAnswer });
      }
      return;
    }

    if (correct) {
      setFeedback({ correct: true, title: PRAISE[idx % PRAISE.length] });
      return;
    }
    // A missed question comes back once, just before the shot. Nothing is taken away.
    if (!step.retry) {
      const again: Step = { ...step, key: `${step.key}-retry`, retry: true };
      setQueue((q) => [...q.slice(0, -1), again, q[q.length - 1]]);
    }
    setFeedback({ correct: false, title: 'Майже!', detail: rightAnswer });
  };

  const done = score.first + score.retry;
  const isShot = step.kind === 'pick' && step.shot;

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <header className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center gap-3">
          <button
            className={`flex h-11 items-center justify-center rounded-xl border border-line bg-panel ${confirmExit ? 'px-3 text-sm font-semibold text-miss' : 'w-11 text-mute'}`}
            onClick={() => (confirmExit ? onExit() : setConfirmExit(true))}
            aria-label={confirmExit ? 'Підтвердити вихід з матчу' : 'Вийти з матчу'}
          >
            {confirmExit ? 'Вийти?' : <X size={22} />}
          </button>
          <p className="display min-w-0 flex-1 truncate text-lg">{plan.title}</p>
          <p className="display text-lg text-gold tabular-nums">
            {Math.min(done, plan.questionCount)}/{plan.questionCount}
          </p>
        </div>
        <Pitch progress={done / plan.questionCount} goal={goal} ball={ball} stadium={stadium} />
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-4">
        {isShot && <p className="display anim-pop mb-2 text-center text-2xl text-gold">Удар по воротах!</p>}
        {step.kind === 'intro' && <IntroView key={step.key} step={step} content={content} say={say} onNext={advance} />}
        {step.kind === 'pick' && (
          <PickView key={step.key} step={step} content={content} say={say} speechStatus={speechStatus} locked={feedback !== null} onAnswer={answer} />
        )}
        {step.kind === 'build' && (
          <BuildView key={step.key} step={step} content={content} say={say} locked={feedback !== null} onAnswer={answer} />
        )}
      </main>

      {feedback && !goal && (
        <footer
          className={`anim-rise flex items-center gap-3 border-t-2 px-4 py-4 ${feedback.correct ? 'border-pitch bg-pitch/20' : 'border-miss bg-miss/15'}`}
          role="status"
        >
          <div className="min-w-0 flex-1">
            <p className={`display text-2xl ${feedback.correct ? 'text-chalk' : 'text-miss'}`}>{feedback.title}</p>
            {feedback.detail && <p className="mt-1 text-lg font-semibold">{feedback.detail}</p>}
          </div>
          {!feedback.correct && (
            <button className="display flex h-14 items-center gap-2 rounded-2xl bg-chalk px-6 text-xl text-night" onClick={advance}>
              Далі <ArrowRight size={22} />
            </button>
          )}
        </footer>
      )}

      {goal && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-night/85" role="status">
          <div className="anim-pop">
            <Ball skin={ball} size={88} />
          </div>
          <p className="display anim-pop text-7xl text-gold">Goal!</p>
          <p className="anim-rise text-lg text-chalk">Ти забив!</p>
        </div>
      )}
    </div>
  );
}

function ListenButtons({ text, say, big = false }: { text: string; say: Say; big?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        className={`flex items-center justify-center rounded-full bg-gold text-night ${big ? 'anim-ring size-24' : 'size-14'}`}
        onClick={() => say(text)}
        aria-label="Послухати"
      >
        <Volume2 size={big ? 44 : 28} />
      </button>
      <button
        className="flex size-14 items-center justify-center rounded-full border-2 border-line bg-panel text-chalk"
        onClick={() => say(text, true)}
        aria-label="Послухати повільно"
      >
        <Turtle size={26} />
      </button>
    </div>
  );
}

function IntroView({ step, content, say, onNext }: { step: IntroStep; content: Content; say: Say; onNext: () => void }) {
  const word = mustWord(content, step.wordId);
  useEffect(() => {
    say(word.english);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-mute">Нове слово · послухай і повтори</p>
      <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-gold/60 bg-gradient-to-b from-panel to-night p-4 text-center">
        <WordImage word={word} className="text-7xl" />
        <p className="display break-words text-5xl text-chalk">{word.english}</p>
        <p className="text-mute">{word.pronunciation}</p>
        <p className="text-2xl font-semibold text-gold">{word.ukrainian}</p>
        <ListenButtons text={word.english} say={say} />
        {word.examples[0] && (
          <button className="rounded-xl border border-line px-4 py-2 text-base text-chalk" onClick={() => say(word.examples[0])}>
            {word.examples[0]}
          </button>
        )}
      </div>
      <button className="display sticky bottom-0 flex h-16 shrink-0 items-center justify-center gap-2 rounded-2xl bg-pitch text-2xl text-chalk shadow-[0_0_0_8px_var(--color-night)]" onClick={onNext}>
        Далі <ArrowRight size={24} />
      </button>
    </div>
  );
}

interface PickProps {
  step: PickStep;
  content: Content;
  say: Say;
  speechStatus: SpeechStatus;
  locked: boolean;
  onAnswer: (correct: boolean, rightAnswer: string) => void;
}

function PickView({ step, content, say, speechStatus, locked, onAnswer }: PickProps) {
  const word = mustWord(content, step.wordId);
  const [chosen, setChosen] = useState<string | null>(null);
  const naming = step.mode === 'name';
  useEffect(() => {
    // In a naming task the spoken word would give the answer away.
    if (!naming) say(word.english);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Without a working voice a listening task would be unanswerable, so the word is shown instead.
  const noAudio = speechStatus === 'unavailable';
  const showText = step.mode === 'read' || noAudio;

  const choose = (id: string) => {
    if (chosen !== null || locked) return;
    setChosen(id);
    const correct = id === step.wordId;
    if (!correct || naming) say(word.english);
    onAnswer(correct, `${word.english} — ${word.ukrainian}`);
  };

  const lookFor = (id: string) => {
    const state = chosen === null ? 'idle' : id === step.wordId ? 'right' : id === chosen ? 'wrong' : 'dim';
    return {
      idle: 'border-line bg-panel active:scale-95',
      right: 'border-pitch bg-pitch/25',
      wrong: 'anim-shake border-miss bg-miss/20',
      dim: 'border-line bg-panel opacity-40',
    }[state];
  };

  if (naming) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-mute">Як це англійською?</p>
          <WordImage word={word} className="text-7xl" />
          <p className="text-2xl font-semibold text-gold" data-prompt="name">
            {word.ukrainian}
          </p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-3">
          {step.options.map((id) => (
            <button
              key={id}
              className={`display min-h-16 break-words rounded-2xl border-2 px-4 py-3 text-2xl not-italic normal-case transition ${lookFor(id)}`}
              onClick={() => choose(id)}
              disabled={chosen !== null || locked}
              data-option={id}
            >
              {mustWord(content, id).english}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-mute">
          {showText ? 'Що це означає?' : 'Послухай і вибери'}
        </p>
        {showText && <p className="display break-words text-5xl text-chalk">{word.english}</p>}
        <ListenButtons text={word.english} say={say} big={!showText} />
        {noAudio && <p className="text-sm text-mute">Звук на цьому пристрої недоступний</p>}
      </div>
      <div className="grid flex-1 grid-cols-2 content-center gap-3">
        {step.options.map((id) => {
          const option = mustWord(content, id);
          const look = lookFor(id);
          return (
            <button
              key={id}
              className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition ${look}`}
              onClick={() => choose(id)}
              disabled={chosen !== null || locked}
              data-option={id}
            >
              <WordImage word={option} className="text-5xl" />
              <span className="text-base font-semibold leading-tight">{option.ukrainian}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface BuildProps {
  step: BuildStep;
  content: Content;
  say: Say;
  locked: boolean;
  onAnswer: (correct: boolean, rightAnswer: string) => void;
}

function BuildView({ step, content, say, locked, onAnswer }: BuildProps) {
  const sentence = content.sentenceById.get(step.sentenceId);
  if (!sentence) throw new Error(`Речення «${step.sentenceId}» відсутнє`);
  /** Indices into step.tokens, in the order the player placed them. */
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const frozen = locked || checked !== null;

  const check = () => {
    const correct = placed.map((i) => step.tokens[i]).join(' ') === sentence.english;
    setChecked(correct);
    say(sentence.english);
    onAnswer(correct, sentence.english);
  };

  const chip = 'display min-h-12 rounded-xl border-2 px-4 py-2 text-xl not-italic normal-case';

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="py-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-mute">Склади англійською</p>
        <p className="mt-2 text-2xl font-semibold text-gold">{sentence.ukrainian}</p>
      </div>
      <div
        className={`flex min-h-20 flex-wrap content-start items-start gap-2 rounded-2xl border-2 border-dashed p-3 ${
          checked === null ? 'border-line' : checked ? 'border-pitch bg-pitch/15' : 'border-miss bg-miss/10'
        }`}
        aria-label="Твоє речення"
      >
        {placed.map((i) => (
          <button
            key={i}
            className={`${chip} border-chalk bg-chalk text-night`}
            onClick={() => setPlaced((p) => p.filter((x) => x !== i))}
            disabled={frozen}
          >
            {step.tokens[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-wrap content-start justify-center gap-2">
        {step.tokens.map((token, i) =>
          placed.includes(i) ? (
            <span key={i} className={`${chip} border-line/50 text-transparent`} aria-hidden="true">
              {token}
            </span>
          ) : (
            <button
              key={i}
              className={`${chip} border-line bg-panel text-chalk active:scale-95`}
              onClick={() => setPlaced((p) => [...p, i])}
              disabled={frozen}
              data-token={token}
            >
              {token}
            </button>
          ),
        )}
      </div>
      {checked === null && (
        <button
          className="display sticky bottom-0 h-16 shrink-0 rounded-2xl bg-pitch text-2xl text-chalk shadow-[0_0_0_8px_var(--color-night)] disabled:bg-panel disabled:text-mute"
          onClick={check}
          disabled={placed.length !== step.tokens.length || locked}
        >
          Перевірити
        </button>
      )}
    </div>
  );
}
