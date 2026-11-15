import { useState } from 'react';
import { Send } from 'lucide-react';
import { weeklyReport } from '../lib/report';
import type { Content, Progress } from '../lib/types';

type State = { kind: 'idle' } | { kind: 'copied' } | { kind: 'manual'; text: string };

/**
 * Sends the weekly report through the phone's share sheet (Viber, Telegram, SMS…).
 * Where sharing is not available the text is copied, or shown for copying by hand.
 */
export function ShareReport({ content, progress, now }: { content: Content; progress: Progress; now: number }) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const share = async () => {
    const text = weeklyReport(content, progress, now);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Football English — звіт', text });
        setState({ kind: 'idle' });
        return;
      } catch (err) {
        // Closing the share sheet is a choice, not an error.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[report] share failed, trying the clipboard', err);
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setState({ kind: 'copied' });
    } catch (err) {
      console.warn('[report] clipboard failed', err);
      setState({ kind: 'manual', text });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-pitch px-3 text-lg font-bold text-chalk" onClick={() => void share()} data-share-report>
        <Send size={22} /> Надіслати звіт батькам
      </button>
      {state.kind === 'copied' && (
        <p className="text-sm text-pitch" role="status">
          Звіт скопійовано. Встав його в Viber чи Telegram і надішли.
        </p>
      )}
      {state.kind === 'manual' && (
        <>
          <p className="text-sm text-mute" role="status">
            Виділи текст, скопіюй і надішли батькам:
          </p>
          <textarea id="report-text" className="h-48 rounded-xl border border-line bg-night p-3 text-sm text-chalk" readOnly value={state.text} onFocus={(e) => e.target.select()} />
        </>
      )}
    </div>
  );
}
