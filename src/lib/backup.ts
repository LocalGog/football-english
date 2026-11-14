import type { Progress } from './types';
import { normalizeProgress } from './progress';

const APP_ID = 'football-english';
export const MAX_BACKUP_BYTES = 1_000_000;

export function serializeBackup(p: Progress, now: Date): string {
  return JSON.stringify({ app: APP_ID, exportedAt: now.toISOString(), progress: p }, null, 2);
}

export function backupFileName(now: Date): string {
  return `${APP_ID}-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** Accepts only our own backup files; anything else yields null. All fields are re-validated. */
export function parseBackup(text: string): Progress | null {
  if (text.length > MAX_BACKUP_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const wrapper = data as { app?: unknown; progress?: unknown };
  if (wrapper.app !== APP_ID) return null;
  const progress = normalizeProgress(wrapper.progress);
  return progress?.player ? progress : null;
}

/** Hands a text file to the browser's download manager. Returns false if the browser refused. */
export function downloadText(fileName: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.warn('[backup] download failed', err);
    return false;
  }
}
