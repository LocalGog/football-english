import { Volume2, X } from 'lucide-react';
import { speak, useSpeechStatus } from '../lib/speech';
import type { Accent, Settings } from '../lib/types';

const ACCENTS: { id: Accent; label: string }[] = [
  { id: 'en-GB', label: 'Британська' },
  { id: 'en-US', label: 'Американська' },
];
const RATES = [
  { value: 0.7, label: 'Повільно' },
  { value: 0.9, label: 'Звичайно' },
  { value: 1.05, label: 'Швидко' },
];

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

export function SettingsSheet({ settings, onChange, onClose }: Props) {
  const status = useSpeechStatus();
  const pill = (active: boolean) =>
    `h-12 flex-1 rounded-xl border-2 text-base font-semibold ${active ? 'border-gold bg-gold/15 text-chalk' : 'border-line bg-night text-mute'}`;

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-night/70" onClick={onClose}>
      <div
        className="anim-rise mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t border-line bg-panel p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування звуку"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">Звук</h2>
          <button className="flex size-11 items-center justify-center rounded-xl border border-line text-mute" onClick={onClose} aria-label="Закрити">
            <X size={22} />
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-mute">Вимова</p>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button key={a.id} className={pill(settings.accent === a.id)} aria-pressed={settings.accent === a.id} onClick={() => onChange({ ...settings, accent: a.id })}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-mute">Швидкість</p>
          <div className="flex gap-2">
            {RATES.map((r) => (
              <button key={r.value} className={pill(settings.rate === r.value)} aria-pressed={settings.rate === r.value} onClick={() => onChange({ ...settings, rate: r.value })}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="display flex h-14 items-center justify-center gap-2 rounded-2xl bg-pitch text-xl text-chalk"
          onClick={() => speak('Pass the ball!', settings)}
        >
          <Volume2 size={22} /> Перевірити звук
        </button>
        {status === 'unavailable' && (
          <p className="text-sm text-miss">
            Телефон не озвучує текст. Перевір гучність і чи встановлено синтез мовлення (на Android: «Синтезатор мовлення Google»). Грати можна й без звуку.
          </p>
        )}
        <p className="text-sm text-mute">Якщо потрібного голосу на телефоні немає, гра візьме будь-який англійський.</p>
      </div>
    </div>
  );
}
