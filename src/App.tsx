import { useEffect, useRef, useState } from 'react';
import { content } from './lib/content';
import { buildMatch, buildReview, type MatchPlan } from './lib/engine';
import { newProgress, playTarget, recordAnswer, recordMatch } from './lib/progress';
import { loadProgress, requestPersistence, saveProgress } from './lib/storage';
import type { MatchResult, Mission, Player, Progress } from './lib/types';
import { Home } from './screens/Home';
import { MissionScreen } from './screens/Mission';
import { Onboarding } from './screens/Onboarding';
import { Result } from './screens/Result';

type Screen =
  | { name: 'home' }
  | { name: 'match'; plan: MatchPlan; run: number }
  | { name: 'result'; plan: MatchPlan; result: MatchResult; xpBefore: number };

export default function App() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [saveFailed, setSaveFailed] = useState(false);
  const runs = useRef(0);

  useEffect(() => {
    let alive = true;
    loadProgress()
      .then((p) => alive && setProgress(p ?? newProgress()))
      .catch((err) => {
        console.error('[app] could not load progress', err);
        if (alive) setProgress(newProgress());
      });
    return () => {
      alive = false;
    };
  }, []);

  // Every change is written straight away, so closing the browser mid-match loses nothing already answered.
  useEffect(() => {
    if (!progress?.player) return;
    let alive = true;
    void saveProgress(progress).then((ok) => alive && setSaveFailed(!ok));
    return () => {
      alive = false;
    };
  }, [progress]);

  if (!progress) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <p className="display text-2xl text-mute">Виходимо на поле…</p>
      </div>
    );
  }

  const startMatch = (mission: Mission | null, from: Progress = progress) => {
    const now = Date.now();
    const plan = mission ? buildMatch(mission, content, from, now) : buildReview(content, from, now);
    runs.current += 1;
    setScreen({ name: 'match', plan, run: runs.current });
  };

  const onboard = (player: Player) => {
    const next = { ...progress, player };
    setProgress(next);
    requestPersistence();
    startMatch(content.missions[0], next);
  };

  let view;
  if (!progress.player) {
    view = <Onboarding onDone={onboard} />;
  } else if (screen.name === 'match') {
    view = (
      <MissionScreen
        key={screen.run}
        plan={screen.plan}
        content={content}
        settings={progress.settings}
        onAnswer={(wordId, correct) => setProgress((p) => (p ? recordAnswer(p, wordId, correct, Date.now()) : p))}
        onFinish={(result) => {
          setScreen({ name: 'result', plan: screen.plan, result, xpBefore: progress.xp });
          setProgress((p) => (p ? recordMatch(p, result) : p));
        }}
        onExit={() => setScreen({ name: 'home' })}
      />
    );
  } else if (screen.name === 'result') {
    view = (
      <Result
        content={content}
        progress={progress}
        plan={screen.plan}
        result={screen.result}
        xpBefore={screen.xpBefore}
        onNext={() => {
          const target = playTarget(content, progress);
          startMatch(target.kind === 'mission' ? target.mission : null);
        }}
        onHome={() => setScreen({ name: 'home' })}
      />
    );
  } else {
    view = (
      <Home
        content={content}
        progress={progress}
        onPlay={startMatch}
        onSettings={(settings) => setProgress((p) => (p ? { ...p, settings } : p))}
        onImport={setProgress}
      />
    );
  }

  return (
    <>
      {saveFailed && (
        <p className="fixed inset-x-0 top-0 z-40 bg-miss px-4 py-2 text-center text-sm font-semibold text-night" role="alert">
          Не вдалося зберегти прогрес. Звільни місце на телефоні або вимкни приватний режим браузера.
        </p>
      )}
      {view}
    </>
  );
}
