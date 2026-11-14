import { useEffect, useRef, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import {
  ballUnlocked, currentBall, currentStadium, kitUnlocked, nextScoutPlayer, signPlayer, stadiumUnlocked, transfersLeft, unlockAchievements,
} from './lib/club';
import { content } from './lib/content';
import { buildMatch, buildReview, buildWeakDrill, pickSpeakWords, type MatchPlan } from './lib/engine';
import { newProgress, playTarget, recordAnswer, recordMatch, recordSpeakDrill } from './lib/progress';
import { loadProgress, requestPersistence, saveProgress } from './lib/storage';
import type { Achievement, ClubPlayer, MatchResult, Mission, Player, Progress } from './lib/types';
import { AwardsScreen } from './screens/Awards';
import { ClubScreen } from './screens/Club';
import { Home } from './screens/Home';
import { MissionScreen } from './screens/Mission';
import { Onboarding } from './screens/Onboarding';
import { PlayScreen } from './screens/Play';
import { Result } from './screens/Result';
import { ScoutScreen } from './screens/Scout';
import { SpeakScreen } from './screens/Speak';

type Screen =
  | { name: 'tabs' }
  | { name: 'match'; plan: MatchPlan; run: number }
  | { name: 'result'; plan: MatchPlan; result: MatchResult; xpBefore: number; unlocked: Achievement[]; tokenEarned: boolean }
  | { name: 'scout'; player: ClubPlayer; run: number }
  | { name: 'speak'; wordIds: string[]; run: number };

const TOAST_MS = 4000;

export default function App() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'tabs' });
  const [tab, setTab] = useState<Tab>('home');
  const [saveFailed, setSaveFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!progress) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <p className="display text-2xl text-mute">Виходимо на поле…</p>
      </div>
    );
  }

  const update = (fn: (p: Progress) => Progress) => setProgress((p) => (p ? fn(p) : p));
  const nextRun = () => (runs.current += 1);

  const startMatch = (mission: Mission | null, from: Progress = progress) => {
    const now = Date.now();
    const plan = mission ? buildMatch(mission, content, from, now) : buildReview(content, from, now);
    setScreen({ name: 'match', plan, run: nextRun() });
  };

  const startWeakDrill = () => setScreen({ name: 'match', plan: buildWeakDrill(content, progress, Date.now()), run: nextRun() });

  const startSpeak = () => {
    const wordIds = pickSpeakWords(content, progress, Date.now());
    if (wordIds.length) setScreen({ name: 'speak', wordIds, run: nextRun() });
  };

  const finishSpeak = (practised: number) => {
    const { progress: next, unlocked } = unlockAchievements(content, recordSpeakDrill(progress, practised), Date.now());
    setProgress(next);
    if (unlocked.length) setToast(`Нове досягнення: ${unlocked.map((a) => a.title).join(', ')}`);
  };

  const backTo = (target: Tab) => {
    setTab(target);
    setScreen({ name: 'tabs' });
  };

  const onboard = (player: Player) => {
    const next = { ...progress, player };
    setProgress(next);
    requestPersistence();
    startMatch(content.missions[0], next);
  };

  const finishMatch = (plan: MatchPlan, result: MatchResult) => {
    const now = Date.now();
    const played = recordMatch(progress, result, now, transfersLeft(content, progress));
    const { progress: next, unlocked } = unlockAchievements(content, played, now);
    setProgress(next);
    setScreen({ name: 'result', plan, result, xpBefore: progress.xp, unlocked, tokenEarned: next.club.tokens > progress.club.tokens });
  };

  const sign = (playerId: string) => {
    const { progress: next, unlocked } = unlockAchievements(content, signPlayer(progress, playerId), Date.now());
    setProgress(next);
    if (unlocked.length) setToast(`Нове досягнення: ${unlocked.map((a) => a.title).join(', ')}`);
  };

  const openClub = () => {
    setTab('club');
    setScreen({ name: 'tabs' });
  };

  const startScout = () => {
    const player = nextScoutPlayer(content, progress);
    if (player && progress.club.tokens > 0) setScreen({ name: 'scout', player, run: nextRun() });
  };

  // Choices are re-checked here: the buttons only offer unlocked items, but imported data is not trusted.
  const chooseKit = (id: string) => {
    const kit = content.kits.find((k) => k.id === id);
    if (kit && kitUnlocked(kit, progress)) update((p) => (p.player ? { ...p, player: { ...p.player, avatar: id } } : p));
  };
  const chooseBall = (id: string) => {
    const ball = content.balls.find((b) => b.id === id);
    if (ball && ballUnlocked(ball, progress)) update((p) => ({ ...p, club: { ...p.club, ball: id } }));
  };
  const chooseStadium = (id: string) => {
    const stadium = content.stadiums.find((s) => s.id === id);
    if (stadium && stadiumUnlocked(stadium, progress)) update((p) => ({ ...p, club: { ...p.club, stadium: id } }));
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
        ball={currentBall(content, progress)}
        stadium={currentStadium(content, progress)}
        hints={progress.adaptive.tier === 0}
        onAnswer={(wordId, correct, mode, chosen) => update((p) => recordAnswer(p, wordId, correct, Date.now(), mode, chosen))}
        onFinish={(result) => finishMatch(screen.plan, result)}
        onExit={() => setScreen({ name: 'tabs' })}
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
        unlocked={screen.unlocked}
        tokenEarned={screen.tokenEarned}
        onClub={openClub}
        onNext={() => {
          const target = playTarget(content, progress);
          startMatch(target.kind === 'mission' ? target.mission : null);
        }}
        onHome={() => {
          setTab('home');
          setScreen({ name: 'tabs' });
        }}
      />
    );
  } else if (screen.name === 'speak') {
    view = (
      <SpeakScreen
        key={screen.run}
        wordIds={screen.wordIds}
        content={content}
        settings={progress.settings}
        onDone={finishSpeak}
        onClose={() => backTo('play')}
      />
    );
  } else if (screen.name === 'scout') {
    view = (
      <ScoutScreen
        key={screen.run}
        player={screen.player}
        content={content}
        progress={progress}
        onAnswer={(wordId, correct) => update((p) => recordAnswer(p, wordId, correct, Date.now()))}
        onSigned={sign}
        onClose={openClub}
      />
    );
  } else {
    view = (
      <div className="mx-auto flex h-full max-w-md flex-col">
        {tab === 'home' && (
          <Home
            content={content}
            progress={progress}
            onPlay={startMatch}
            onSettings={(settings) => update((p) => ({ ...p, settings }))}
            onImport={setProgress}
          />
        )}
        {tab === 'play' && <PlayScreen content={content} progress={progress} onPlay={startMatch} onWeak={startWeakDrill} onSpeak={startSpeak} />}
        {tab === 'club' && (
          <ClubScreen content={content} progress={progress} onScout={startScout} onKit={chooseKit} onBall={chooseBall} onStadium={chooseStadium} />
        )}
        {tab === 'awards' && <AwardsScreen content={content} progress={progress} />}
        <BottomNav tab={tab} onTab={setTab} clubBadge={nextScoutPlayer(content, progress) ? progress.club.tokens : 0} />
      </div>
    );
  }

  return (
    <>
      {saveFailed && (
        <p className="fixed inset-x-0 top-0 z-40 bg-miss px-4 py-2 text-center text-sm font-semibold text-night" role="alert">
          Не вдалося зберегти прогрес. Звільни місце на телефоні або вимкни приватний режим браузера.
        </p>
      )}
      {toast && (
        <p className="anim-rise fixed inset-x-4 top-4 z-40 mx-auto max-w-md rounded-2xl bg-gold px-4 py-3 text-center font-semibold text-night shadow-lg" role="status">
          {toast}
        </p>
      )}
      {view}
    </>
  );
}
