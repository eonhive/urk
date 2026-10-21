/**
 * Company: EonHive Inc. | Title: Audio Host Preferences
 * Purpose: Let hosts opt into validated visual settings memory without saving playback or files.
 * Author: Stan Nesi | Created: 2026-10-19 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { resolveAudioReactions, type AudioReactionSettings } from './reactions.js';

/** A saved record must contain every field; never restore only part of a record. */
function readPreferences(value: unknown): Readonly<AudioReactionSettings> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !record.reactions || typeof record.reactions !== 'object' ||
      Array.isArray(record.reactions)) return;
  const reactions = record.reactions as Record<string, unknown>;
  for (const key of ['intensity', 'bass', 'mids', 'treble'] as const) {
    if (!Object.prototype.hasOwnProperty.call(reactions, key) || typeof reactions[key] !== 'number') return;
  }
  try { return resolveAudioReactions(reactions); }
  catch { return; }
}

/** The host owns opt-in, its storage key, and the preference control's lifetime. */
export function mountAudioPreferences(host: HTMLElement, ctx: RuntimeContext, key: string) {
  if (!key.trim()) throw new TypeError('Audio preferences require a non-empty storage key.');
  if (ctx.signal.aborted) throw new Error('Cannot mount audio preferences in an aborted runtime.');
  const root = document.createElement('div');
  root.className = 'urk-audio-preferences';
  root.innerHTML = `<style>
    .urk-audio-preferences { margin:16px 0; padding:12px; border:1px solid #394762; border-radius:10px; background:#111a2d; color:#e7edf9; font:13px/1.5 system-ui,sans-serif; }
    .urk-audio-preferences label { display:flex; align-items:center; gap:8px; }
    .urk-audio-preferences input { accent-color:#7be3cd; }
    .urk-audio-preferences input:focus-visible { outline:3px solid #b0a8ff; outline-offset:3px; }
    .urk-audio-preferences p { margin:8px 0 0; font-size:12px; color:#afbed5; }
  </style><label><input type="checkbox" /> Remember visual response on this device</label>
    <p role="status"></p>`;
  const checkbox = root.querySelector('input')!;
  const message = root.querySelector('p')!;
  const events = new AbortController();
  let current = resolveAudioReactions();
  let lastSaved: string | undefined;
  let storageAvailable = true;
  let closed = false;
  const encode = () => JSON.stringify({ version: 1, reactions: current });
  try {
    const raw = window.localStorage.getItem(key);
    const restored = raw === null ? undefined : readPreferences(JSON.parse(raw));
    if (restored) {
      current = restored;
      checkbox.checked = true;
      lastSaved = encode();
      message.textContent = 'Saved visual response restored. Turn off to forget it.';
    } else message.textContent = raw === null
      ? 'Off. Visual response stays local to this mount.'
      : 'Saved settings were invalid. Using default visual response.';
  } catch (error) {
    if (error instanceof SyntaxError) message.textContent = 'Saved settings were invalid. Using default visual response.';
    else {
      storageAvailable = false;
      message.textContent = 'Storage unavailable. Visual response still works for this mount.';
    }
  }
  const live = () => !closed && !ctx.signal.aborted && !document.hidden &&
    ctx.getLifecycleSnapshot().state === 'running';
  const sync = () => { checkbox.disabled = !storageAvailable || !live(); };
  const close = () => { closed = true; events.abort(); root.remove(); };
  ctx.scope.defer(() => { ctx.signal.removeEventListener('abort', close); close(); });
  ctx.signal.addEventListener('abort', close, { once: true });
  ctx.scope.defer(ctx.subscribeLifecycle(sync));
  document.addEventListener('visibilitychange', sync, { signal: events.signal });
  const save = () => {
    if (closed || ctx.signal.aborted || !storageAvailable || !checkbox.checked) return;
    const value = encode();
    if (value === lastSaved) return;
    try {
      window.localStorage.setItem(key, value);
      lastSaved = value;
      message.textContent = 'Visual response saved on this device. Turn off to forget it.';
    } catch {
      message.textContent = 'Could not save visual response. Changes still work for this mount.';
    }
  };
  checkbox.addEventListener('change', () => {
    if (!live() || !storageAvailable) return;
    if (checkbox.checked) { save(); return; }
    lastSaved = undefined;
    try {
      window.localStorage.removeItem(key);
      message.textContent = 'Saved visual response forgotten. Current settings stay unchanged.';
    } catch {
      message.textContent = 'Saving is off, but saved settings could not be removed. They may return after reload.';
    }
  }, { signal: events.signal });
  host.append(root);
  sync();
  return {
    restore(): Readonly<AudioReactionSettings> | undefined {
      return !closed && checkbox.checked ? current : undefined;
    },
    changed(settings: Readonly<AudioReactionSettings>): void {
      if (closed || ctx.signal.aborted) return;
      const next = readPreferences({ version: 1, reactions: settings });
      if (!next) throw new TypeError('Invalid audio reaction settings.');
      current = next;
      save();
    },
  };
}
