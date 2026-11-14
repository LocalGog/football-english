import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Mic, Play, Square, Turtle, Volume2, X } from 'lucide-react';
import { WordImage } from '../components/WordImage';
import { XP_SPEAK_DRILL } from '../lib/progress';
import { canRecord, VoiceRecorder } from '../lib/recorder';
import { speak, stopSpeaking } from '../lib/speech';
import type { Content, Settings } from '../lib/types';

const MAX_RECORD_MS = 4000;
const SLOW_RATE = 0.55;

interface Props {
  wordIds: string[];
  content: Content;
  settings: Settings;
  onDone: (practised: number, seconds: number) => void;
  onClose: () => void;
}

type Mic = 'idle' | 'recording' | 'unavailable';

/**
 * Pronunciation drill: listen, say it aloud, optionally record yourself and compare by ear.
 * No speech recognition: the recording never leaves the phone, and the drill works without a microphone.
 */
export function SpeakScreen({ wordIds, content, settings, onDone, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [mic, setMic] = useState<Mic>(canRecord() ? 'idle' : 'unavailable');
  const [take, setTake] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const recorder = useRef(new VoiceRecorder());
  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef(Date.now());
  const word = content.wordById.get(wordIds[index]);
  const say = (text: string, slow = false) => speak(text, { accent: settings.accent, rate: slow ? SLOW_RATE : settings.rate });

  const dropTake = () =>
    setTake((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });

  useEffect(() => {
    if (word) say(word.english);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const rec = recorder.current;
    return () => {
      window.clearTimeout(timer.current);
      rec.release();
      stopSpeaking();
    };
  }, []);

  const stopRecording = async () => {
    window.clearTimeout(timer.current);
    const url = await recorder.current.stop();
    setTake(url);
    setMic('idle');
  };

  const startRecording = async () => {
    dropTake();
    stopSpeaking();
    try {
      await recorder.current.start();
      setMic('recording');
      timer.current = window.setTimeout(() => void stopRecording(), MAX_RECORD_MS);
    } catch (err) {
      console.warn('[speak] microphone unavailable', err);
      setMic('unavailable');
    }
  };

  const playTake = () => {
    if (!take) return;
    new Audio(take).play().catch((err) => console.warn('[speak] playback failed', err));
  };

  const next = () => {
    if (mic === 'recording') recorder.current.release();
    window.clearTimeout(timer.current);
    if (mic !== 'unavailable') setMic('idle');
    dropTake();
    if (index + 1 < wordIds.length) return setIndex(index + 1);
    setFinished(true);
    onDone(wordIds.length, Math.round((Date.now() - startedAt.current) / 1000));
  };

  if (!word) throw new Error(`Слово «${wordIds[index]}» відсутнє у словнику`);
  const round = 'flex size-16 items-center justify-center rounded-full';

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <header className="flex items-center gap-3 px-4 pt-4">
        <button className="flex size-11 items-center justify-center rounded-xl border border-line bg-panel text-mute" onClick={onClose} aria-label="Закрити тренування вимови">
          <X size={22} />
        </button>
        <p className="display flex-1 text-lg">Say it</p>
        {!finished && (
          <p className="display text-lg tabular-nums text-gold">
            {index + 1}/{wordIds.length}
          </p>
        )}
      </header>

      {finished ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center" data-speak-done>
          <p className="display anim-pop text-5xl text-gold">Well done!</p>
          <p className="text-lg">
            Ти потренував вимову {wordIds.length} слів. +{XP_SPEAK_DRILL} XP
          </p>
          <button className="display h-16 w-full rounded-2xl bg-gold text-2xl text-night" onClick={onClose}>
            Готово
          </button>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" data-speak-word={word.id}>
          <section className="flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-gold/60 bg-gradient-to-b from-panel to-night p-4 text-center">
            <WordImage word={word} className="text-7xl" />
            <p className="display break-words text-5xl">{word.english}</p>
            <p className="text-mute">{word.pronunciation}</p>
            <p className="text-2xl font-semibold text-gold">{word.ukrainian}</p>
          </section>

          <section className="grid grid-cols-3 items-start gap-2 text-center text-xs text-mute">
            <div className="flex flex-col items-center gap-1">
              <div className="flex gap-2">
                <button className={`${round} bg-gold text-night`} onClick={() => say(word.english)} aria-label="Послухати зразок">
                  <Volume2 size={28} />
                </button>
              </div>
              1. Послухай
              <button className="flex items-center gap-1 text-chalk underline" onClick={() => say(word.english, true)}>
                <Turtle size={14} /> повільно
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              {mic === 'unavailable' ? (
                <span className={`${round} border-2 border-dashed border-line text-mute`} aria-hidden="true">
                  <Mic size={26} />
                </span>
              ) : mic === 'recording' ? (
                <button className={`${round} anim-ring bg-miss text-night`} onClick={() => void stopRecording()} aria-label="Зупинити запис" data-rec="stop">
                  <Square size={24} fill="currentColor" />
                </button>
              ) : (
                <button className={`${round} border-2 border-chalk bg-panel text-chalk`} onClick={() => void startRecording()} aria-label="Записати себе" data-rec="start">
                  <Mic size={26} />
                </button>
              )}
              {mic === 'unavailable' ? '2. Скажи вголос' : mic === 'recording' ? 'Говори…' : '2. Скажи й запиши'}
            </div>
            <div className="flex flex-col items-center gap-1">
              {take ? (
                <button className={`${round} bg-pitch text-chalk`} onClick={playTake} aria-label="Послухати свій запис" data-rec="play">
                  <Play size={26} fill="currentColor" />
                </button>
              ) : (
                <span className={`${round} border-2 border-dashed border-line text-mute`} aria-hidden="true">
                  <Play size={26} />
                </span>
              )}
              3. Порівняй
            </div>
          </section>
          {mic === 'unavailable' && <p className="text-center text-sm text-mute">Мікрофон недоступний. Просто повтори слово вголос за зразком.</p>}

          <button className="display sticky bottom-0 flex h-16 shrink-0 items-center justify-center gap-2 rounded-2xl bg-pitch text-2xl text-chalk" onClick={next} data-speak-next>
            {index + 1 < wordIds.length ? 'Далі' : 'Завершити'} <ArrowRight size={24} />
          </button>
        </main>
      )}
    </div>
  );
}
