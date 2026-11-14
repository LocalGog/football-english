import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { backupFileName, downloadText, MAX_BACKUP_BYTES, parseBackup, serializeBackup } from '../lib/backup';
import type { Progress } from '../lib/types';

/** Save progress to a JSON file and restore it, with confirmation before anything is replaced. */
export function BackupPanel({ progress, onImport }: { progress: Progress; onImport: (p: Progress) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Progress | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const exportBackup = () => {
    const now = new Date();
    const ok = downloadText(backupFileName(now), serializeBackup(progress, now));
    setNote(ok ? { ok: true, text: 'Копію збережено в завантаженнях.' } : { ok: false, text: 'Браузер не дозволив зберегти файл.' });
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

  const btn = 'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line bg-night font-semibold text-chalk';
  return (
    <div>
      <div className="flex gap-2">
        <button className={btn} onClick={exportBackup}>
          <Download size={18} /> Зберегти
        </button>
        <button className={btn} onClick={() => fileInput.current?.click()}>
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
  );
}
