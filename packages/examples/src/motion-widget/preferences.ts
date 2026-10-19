/**
 * Company: EonHive Inc. | Title: Motion Widget Host Preferences
 * Purpose: Let example hosts opt into validated local settings without storing playback state.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import type { ResourceScope } from '@urk/core';
import { defaultWidgetTiming, resolveWidgetTiming, type MotionWidgetTiming } from './timing.js';

export interface MotionWidgetSettings {
  readonly timing: Readonly<MotionWidgetTiming>;
  readonly playbackRate: number;
}

/** Stored records are untrusted; reject the whole record rather than partially restoring it. */
export function readWidgetSettings(value: unknown): MotionWidgetSettings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !record.timing || typeof record.timing !== 'object') return undefined;
  const timing = record.timing as Record<string, unknown>;
  if (
    Object.keys(defaultWidgetTiming).some(
      (key) => !Object.prototype.hasOwnProperty.call(timing, key),
    )
  )
    return undefined;
  if (
    typeof record.playbackRate !== 'number' ||
    !Number.isFinite(record.playbackRate) ||
    record.playbackRate <= 0
  )
    return undefined;
  try {
    return Object.freeze({
      timing: Object.freeze(resolveWidgetTiming(timing)),
      playbackRate: record.playbackRate,
    });
  } catch {
    return undefined;
  }
}

/** The host chooses a stable key and owns this control independently of the widget. */
export function mountWidgetPreferences(host: HTMLElement, scope: ResourceScope, key: string) {
  if (!key.trim()) throw new TypeError('Widget preferences require a non-empty storage key.');
  const root = document.createElement('div');
  root.className = 'umw-preferences';
  root.style.cssText =
    'margin:14px 0;padding:12px;border:1px solid #364258;border-radius:10px;background:#101725;color:#d2d9e8;font:12px/1.5 system-ui,sans-serif';
  root.innerHTML = `<label style="display:flex;align-items:center;gap:10px;cursor:pointer">
    <input type="checkbox" aria-label="Remember settings on this device" />
    Remember settings on this device
  </label><p style="margin:8px 0 0;color:#a4afc3;font-size:11px" role="status"></p>`;
  const checkbox = root.querySelector('input')!;
  checkbox.style.accentColor = '#7ce8e3';
  const message = root.querySelector('p')!;
  let current: MotionWidgetSettings = Object.freeze({
    timing: defaultWidgetTiming,
    playbackRate: 1,
  });
  let lastSaved: string | undefined;
  let disposed = false;
  const encode = () =>
    JSON.stringify({ version: 1, timing: current.timing, playbackRate: current.playbackRate });

  try {
    const raw = window.localStorage.getItem(key);
    const restored = raw === null ? undefined : readWidgetSettings(JSON.parse(raw));
    if (restored) {
      current = restored;
      checkbox.checked = true;
      lastSaved = encode();
      message.textContent = 'Saved settings restored. Turn off to forget them.';
    } else {
      message.textContent =
        raw === null
          ? 'Off. Timing and speed stay local to this mount.'
          : 'Saved settings were invalid. Using mount defaults.';
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      message.textContent = 'Saved settings were invalid. Using mount defaults.';
    } else {
      checkbox.disabled = true;
      message.textContent = 'Storage unavailable. Settings still work for this mount.';
    }
  }

  function save(): void {
    if (disposed || !checkbox.checked) return;
    const value = encode();
    if (value === lastSaved) return;
    try {
      window.localStorage.setItem(key, value);
      lastSaved = value;
      message.textContent = 'Timing and speed saved on this device. Turn off to forget them.';
    } catch {
      message.textContent = 'Could not save settings. Changes still work for this mount.';
    }
  }

  const listeners = new AbortController();
  checkbox.addEventListener(
    'change',
    () => {
      if (disposed) return;
      if (checkbox.checked) {
        save();
        return;
      }
      lastSaved = undefined;
      try {
        window.localStorage.removeItem(key);
        message.textContent = 'Saved settings forgotten. Current playback stays unchanged.';
      } catch {
        message.textContent =
          'Saving is off, but saved settings could not be removed. They may return after reload.';
      }
    },
    { signal: listeners.signal },
  );
  scope.defer(() => {
    disposed = true;
    listeners.abort();
    root.remove();
  });
  host.append(root);

  return {
    restore(): MotionWidgetSettings | undefined {
      return !disposed && checkbox.checked ? current : undefined;
    },
    changed(settings: MotionWidgetSettings): void {
      if (disposed) return;
      const next = readWidgetSettings({
        version: 1,
        timing: settings.timing,
        playbackRate: settings.playbackRate,
      });
      if (!next) throw new TypeError('Invalid widget settings.');
      current = next;
      save();
    },
  };
}
