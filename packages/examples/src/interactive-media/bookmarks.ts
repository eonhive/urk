/**
 * Company: EonHive Inc. | Title: Media Bookmarks
 * Purpose: Validate playback preferences and borrow resilient browser storage.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

export type Branch = 'explore' | 'create' | null;
export interface Bookmark {
  version: 1;
  position: number;
  branch: Branch;
  captions: boolean;
  musicVolume?: number;
  narrationVolume?: number;
}

export function readBookmark(value: unknown): Bookmark {
  const saved = value && typeof value === 'object' ? (value as Partial<Bookmark>) : {};
  if (saved.version !== 1) return { version: 1, position: 0, branch: null, captions: false };
  const bookmark: Bookmark = {
    version: 1,
    position:
      typeof saved.position === 'number' && Number.isFinite(saved.position) && saved.position >= 0
        ? saved.position
        : 0,
    branch: saved.branch === 'explore' || saved.branch === 'create' ? saved.branch : null,
    captions: saved.captions === true,
  };
  const music = validVolume(saved.musicVolume);
  const narration = validVolume(saved.narrationVolume);
  if (music !== undefined) bookmark.musicVolume = music;
  if (narration !== undefined) bookmark.narrationVolume = narration;
  return bookmark;
}

function validVolume(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined;
}

// Borrowed memory survives replacement kernels in this page. No accounts or uploads.
const memory = new Map<string, string>();
export function borrowMediaStorage(onFallback: () => void): Storage {
  let browser: Storage | undefined;
  try {
    browser = window.localStorage;
  } catch {
    onFallback();
  }
  const read = <T>(native: (storage: Storage) => T, fallback: () => T): T => {
    if (browser) {
      try {
        return native(browser);
      } catch {
        browser = undefined;
        onFallback();
      }
    }
    return fallback();
  };
  return {
    get length() {
      return read(
        (storage) => storage.length,
        () => memory.size,
      );
    },
    key: (index) =>
      read(
        (storage) => storage.key(index),
        () => [...memory.keys()][index] ?? null,
      ),
    getItem(key) {
      return read(
        (storage) => {
          const value = storage.getItem(key);
          if (value !== null) memory.set(key, value);
          else memory.delete(key);
          return value;
        },
        () => memory.get(key) ?? null,
      );
    },
    setItem(key, value) {
      memory.set(key, value);
      read(
        (storage) => storage.setItem(key, value),
        () => {},
      );
    },
    removeItem(key) {
      memory.delete(key);
      read(
        (storage) => storage.removeItem(key),
        () => {},
      );
    },
    clear() {
      throw new Error('Clear individual media keys through the namespaced storage adapter.');
    },
  };
}
