import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, Volume2, X } from 'lucide-react';
import { backupFileName, downloadText, MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../lib/backup';
import { speak, useSpeechStatus } from '../lib/speech';
import type { Accent, Progress, Settings } from '../lib/types';

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
  progress: Progress;
  onChange: (s: Settings) => void;
  onImport: (p: Progress) => void;
  onClose: () => void;
}

export function SettingsSheet({ progress, onChange, onImport, onClose }: Props) {
  const settings = progress.settings;
  const status = useSpeechStatus();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Progress | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const exportBackup = () => {
    const now = new Date();
    const ok = downloadText(backupFileName(now), serializeBackup(progress, now));
    setNote(ok ? { ok: true, text: 'Копію збережено в завантаженнях телефона.' } : { ok: false, text: 'Браузер не дозволив зберегти файл.' });
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setPending(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setNote({ ok: false, text: 'Файл завеликий. Це не копія Football English.' });
      return;
    }
    try {
      const restored = parseBackup(await file.text());
      if (!restored) {
        setNote({ ok: false, text: 'Це не файл копії Football English або він пошкоджений.' });
        return;
      }
      setNote(null);
      setPending(restored);
    } catch (err) {
      console.warn('[backup] could not read file', err);
      setNote({ ok: false, text: 'Не вдалося прочитати файл.' });
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    onImport(pending);
    setPending(null);
    setNote({ ok: true, text: 'Прогрес відновлено.' });
  };
  const pill = (active: boolean) =>
    `h-12 flex-1 rounded-xl border-2 text-base font-semibold ${active ? 'border-gold bg-gold/15 text-chalk' : 'border-line bg-night text-mute'}`;

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-night/70" onClick={onClose}>
      <div
        className="anim-rise mx-auto flex max-h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-line bg-panel p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">Налаштування</h2>
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

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-mute">Резервна копія прогресу</p>
          <div className="flex gap-2">
            <button className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line bg-night font-semibold text-chalk" onClick={exportBackup}>
              <Download size={18} /> Зберегти
            </button>
            <button
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line bg-night font-semibold text-chalk"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={18} /> Відновити
            </button>
            <input id="backup-file" ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={pickFile} />
          </div>
          {pending && (
            <div className="mt-3 rounded-xl border-2 border-gold p-3" role="alertdialog" aria-label="Підтвердження відновлення">
              <p className="text-sm">
                У копії: гравець «{pending.player?.name}», {pending.xp} XP. Поточний прогрес буде замінено.
              </p>
              <div className="mt-2 flex gap-2">
                <button className="h-11 flex-1 rounded-xl bg-gold font-semibold text-night" onClick={confirmImport}>
                  Замінити
                </button>
                <button className="h-11 flex-1 rounded-xl border-2 border-line font-semibold text-chalk" onClick={() => setPending(null)}>
                  Скасувати
                </button>
              </div>
            </div>
          )}
          {note && (
            <p className={`mt-2 text-sm ${note.ok ? 'text-pitch' : 'text-miss'}`} role="status">
              {note.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
