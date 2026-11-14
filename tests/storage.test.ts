import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newProgress, recordAnswer } from '../src/lib/progress';
import { loadProgress, saveProgress } from '../src/lib/storage';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
});

describe('storage', () => {
  it('round-trips progress through IndexedDB', async () => {
    const p = recordAnswer({ ...newProgress(), player: { name: 'Max', avatar: 'blue' }, xp: 40 }, 'ball', true, 10);
    expect(await saveProgress(p)).toBe(true);
    store.clear(); // prove the copy comes from IndexedDB
    expect(await loadProgress()).toEqual(p);
  });

  it('falls back to localStorage when IndexedDB is missing', async () => {
    const g = globalThis as { indexedDB?: unknown };
    const real = g.indexedDB;
    g.indexedDB = undefined;
    try {
      const p = { ...newProgress(), player: { name: 'Ann', avatar: 'red' }, xp: 5 };
      expect(await saveProgress(p)).toBe(true);
      expect(await loadProgress()).toEqual(p);
    } finally {
      g.indexedDB = real;
    }
  });
});
