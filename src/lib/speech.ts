import { useSyncExternalStore } from 'react';
import type { Accent } from './types';

/** unknown until the first utterance either starts or times out. */
export type SpeechStatus = 'unknown' | 'ok' | 'unavailable';

const START_TIMEOUT_MS = 3000;
const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let status: SpeechStatus = synth ? 'unknown' : 'unavailable';
const listeners = new Set<() => void>();

function setStatus(next: SpeechStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

export function useSpeechStatus(): SpeechStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
  );
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase();

/** Preferred accent first, then any English voice; null lets the engine pick by `lang`. */
function pickVoice(accent: Accent): SpeechSynthesisVoice | null {
  const voices = synth?.getVoices() ?? [];
  const english = voices.filter((v) => norm(v.lang).startsWith('en'));
  return english.find((v) => norm(v.lang) === accent.toLowerCase()) ?? english[0] ?? null;
}

// Chrome fills the voice list asynchronously; touching it early starts the load.
try {
  synth?.getVoices();
} catch {
  /* ignore */
}

export function speak(text: string, opts: { accent: Accent; rate: number }): void {
  if (!synth) return; // keep trying when 'unavailable': a late-loading engine flips the status back
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(opts.accent);
    if (voice) u.voice = voice;
    u.lang = voice?.lang.replace('_', '-') ?? opts.accent;
    u.rate = opts.rate;

    // Some devices expose the API but have no TTS engine: the utterance never starts.
    const timer = window.setTimeout(() => {
      if (status === 'unknown') setStatus('unavailable');
    }, START_TIMEOUT_MS);
    u.onstart = () => {
      window.clearTimeout(timer);
      setStatus('ok');
    };
    u.onend = () => window.clearTimeout(timer);
    u.onerror = (e) => {
      window.clearTimeout(timer);
      // Being interrupted by the next word or blocked before the first tap says nothing about the device.
      if (e.error === 'interrupted' || e.error === 'canceled' || e.error === 'not-allowed') return;
      console.warn('[speech] synthesis error:', e.error);
      if (status === 'unknown') setStatus('unavailable');
    };
    synth.speak(u);
  } catch (err) {
    console.warn('[speech] speak failed', err);
    if (status === 'unknown') setStatus('unavailable');
  }
}

export function stopSpeaking(): void {
  try {
    synth?.cancel();
  } catch {
    /* ignore */
  }
}
