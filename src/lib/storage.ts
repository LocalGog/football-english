import type { Progress } from './types';
import { normalizeProgress } from './progress';

const DB_NAME = 'football-english';
const STORE = 'kv';
const KEY = 'progress';
const LS_KEY = 'football-english:progress';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

async function idbGet(): Promise<unknown> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(value: Progress): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** IndexedDB first; localStorage is a second copy for browsers where IndexedDB is blocked. */
export async function loadProgress(): Promise<Progress | null> {
  try {
    const fromDb = normalizeProgress(await idbGet());
    if (fromDb) return fromDb;
  } catch (err) {
    console.warn('[storage] IndexedDB read failed, trying localStorage', err);
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : null;
  } catch (err) {
    console.warn('[storage] localStorage read failed', err);
    return null;
  }
}

/** Resolves to false only when nothing could be written anywhere. */
export async function saveProgress(p: Progress): Promise<boolean> {
  let saved = false;
  try {
    await idbSet(p);
    saved = true;
  } catch (err) {
    console.warn('[storage] IndexedDB write failed', err);
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
    saved = true;
  } catch (err) {
    console.warn('[storage] localStorage write failed', err);
  }
  return saved;
}

/** Asks the browser not to evict our data under storage pressure. Best effort. */
export function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* not supported: nothing to do */
  }
}
