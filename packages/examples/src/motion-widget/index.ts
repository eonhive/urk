/**
 * Company: EonHive Inc. | Title: Embedded Motion Widget
 * Purpose: Mount an independently owned DOM sequence in a borrowed runtime and host.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { ResourceScope, type RuntimeContext } from '@urk/core';
import {
  createDomMotionBinding,
  fade,
  slide,
  stagger,
  MotionCapability,
  type MotionResult,
  type MotionStatus,
  type TimelineHandle,
} from '@urk/adapters/motion';
import {
  defaultWidgetTiming,
  resolveWidgetTiming,
  widgetDurationMs,
  type MotionWidgetTiming,
} from './timing.js';
import { motionWidgetStyles } from './styles.js';
import type { MotionWidgetSettings } from './preferences.js';
import { parseWidgetPreset, serializeWidgetPreset, widgetPresetMaxLength } from './presets.js';

export type { MotionWidgetTiming } from './timing.js';
export { mountWidgetPreferences, type MotionWidgetSettings } from './preferences.js';
export { parseWidgetPreset, serializeWidgetPreset } from './presets.js';

export interface MotionWidgetOptions {
  title: string;
  tone?: 'cyan' | 'violet';
  suspendWhenOffscreen?: boolean;
  timing?: Partial<MotionWidgetTiming>;
  playbackRate?: number;
  /** Observe committed timing/speed changes; the host owns any persistence policy. */
  onSettingsChange?: (settings: MotionWidgetSettings) => void;
  /** Observe rendered playback/visibility changes without retaining a host frame loop. */
  onChange?: () => void;
}

export interface MotionWidget {
  replay(): Promise<MotionResult>;
  /** Render a finite clamped time and pause this sequence without resuming the runtime. */
  seek(timeMs: number): void;
  /** Validate and stage settings for the next replay without changing live playback. */
  setTiming(timing: Partial<MotionWidgetTiming>): void;
  /** Change current and future playback without seeking, replaying, or resuming. */
  setPlaybackRate(rate: number): void;
  /** Export committed timing/speed, without playback state or persistence consent. */
  exportPreset(): string;
  /** Validate then commit both settings together, preserving position and pauses. */
  importPreset(json: string): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  getSnapshot(): Readonly<{
    status: MotionStatus | 'idle' | 'disposed';
    progress: number;
    offscreen: boolean;
    userPaused: boolean;
    timing: Readonly<MotionWidgetTiming>;
    currentTimeMs: number;
    durationMs: number;
    playbackRate: number;
  }>;
  teardown(): Promise<void>;
}

/** The caller registers one motion adapter; widgets borrow its temporary frame work. */
export async function mountMotionWidget(
  host: HTMLElement,
  ctx: RuntimeContext,
  options: MotionWidgetOptions,
): Promise<MotionWidget> {
  // Reject invalid mount configuration before acquiring resources or changing the host.
  let timing = resolveWidgetTiming(options.timing);
  const scope = new ResourceScope();
  // Bind only the scope, so an unmounted widget's DOM is not retained by its parent.
  ctx.scope.defer(scope.dispose.bind(scope));
  try {
    const api = ctx.require(MotionCapability);
    const motion = api.scoped(scope);
    if (options.playbackRate !== undefined) motion.setPlaybackRate(options.playbackRate);
    const root = document.createElement('section');
    scope.defer(() => root.remove());
    root.className = 'umw';
    root.dataset.tone = options.tone ?? 'cyan';
    root.setAttribute('aria-label', `${options.title} motion widget`);
    root.innerHTML = `
      <div class="umw-heading"><h2></h2><span class="umw-status">idle</span></div>
      <p class="umw-intro">A small idea. A little momentum.</p>
      <div class="umw-art" aria-hidden="true">
        <div class="umw-tile"><i>○</i><span>Listen</span></div>
        <div class="umw-tile"><i>◇</i><span>Shape</span></div>
        <div class="umw-tile"><i>✳</i><span>Send</span></div>
      </div>
      <div class="umw-result" aria-hidden="true">↗ Ready for what comes next.</div>
      <p class="umw-visibility"></p>
      <span class="umw-time">0 / 1,300 ms</span>
      <progress class="umw-progress" max="1" value="0"></progress>
      <label class="umw-scrub">Scrub sequence
        <input type="range" min="0" max="1000" step="1" value="0" aria-label="Scrub sequence" />
      </label>
      <p class="umw-scrub-hint">Scrubbing pauses this sequence. Use arrow keys or Home/End.</p>
      <div class="umw-controls">
        <button type="button" data-action="replay">Replay</button>
        <button type="button" data-action="pause">Pause sequence</button>
        <button type="button" data-action="cancel">Cancel</button>
      </div>
      <label class="umw-speed">Playback speed
        <select aria-label="Playback speed">
          <option value="0.5">0.5× · Slow</option>
          <option value="1" selected>1× · Normal</option>
          <option value="2">2× · Fast</option>
          <option data-custom-speed hidden disabled></option>
        </select>
      </label>
      <details class="umw-timing">
        <summary>Timing settings</summary>
        <fieldset>
          <legend>Sequence timing</legend>
          <div class="umw-timing-fields">
            <label>Entrance (ms)<input data-timing="entranceMs" type="number" min="0" max="10000" step="1" required /></label>
            <label>Stagger (ms)<input data-timing="staggerMs" type="number" min="0" max="10000" step="1" required /></label>
            <label>Final reveal (ms)<input data-timing="revealMs" type="number" min="0" max="10000" step="1" required /></label>
          </div>
          <p>Draft sequence: <span class="umw-draft-duration"></span></p>
          <div class="umw-controls">
            <button type="button" data-action="apply">Apply &amp; replay</button>
            <button type="button" data-action="reset">Reset timing</button>
          </div>
          <p>Edits wait for Apply &amp; replay. Each value accepts 0–10,000 whole milliseconds.</p>
        </fieldset>
      </details>
      <details class="umw-presets">
        <summary>Share settings</summary>
        <label>Preset JSON
          <textarea aria-label="Preset JSON" rows="9" spellcheck="false"></textarea>
        </label>
        <div class="umw-controls">
          <button type="button" data-action="export">Export JSON</button>
          <button type="button" data-action="import">Import JSON</button>
        </div>
        <p>Import preserves position and pauses. New timing starts on the next replay.</p>
        <p class="umw-preset-message" role="status">Export current settings, or paste a preset to import.</p>
      </details>
      <p class="umw-message" role="status">Ready to play.</p>`;
    // Keep styles in the owned root so compiled examples need no CSS asset copying.
    const style = document.createElement('style');
    style.textContent = motionWidgetStyles;
    root.prepend(style);
    const read = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    read('h2').textContent = options.title;
    const progress = read<HTMLProgressElement>('.umw-progress');
    progress.setAttribute('aria-label', `${options.title} sequence progress`);
    const status = read('.umw-status');
    const visibility = read('.umw-visibility');
    const time = read('.umw-time');
    const scrubber = read<HTMLInputElement>('.umw-scrub input');
    const speed = read<HTMLSelectElement>('.umw-speed select');
    const customSpeed = read<HTMLOptionElement>('[data-custom-speed]');
    const timingFields = read<HTMLFieldSetElement>('.umw-timing fieldset');
    const timingInputs = [...root.querySelectorAll<HTMLInputElement>('[data-timing]')];
    const draftDuration = read('.umw-draft-duration');
    const message = read('.umw-message');
    const presetJson = read<HTMLTextAreaElement>('.umw-presets textarea');
    presetJson.maxLength = widgetPresetMaxLength;
    const presetMessage = read('.umw-preset-message');
    const exportButton = read<HTMLButtonElement>('[data-action="export"]');
    const importButton = read<HTMLButtonElement>('[data-action="import"]');
    const replayButton = read<HTMLButtonElement>('[data-action="replay"]');
    const pauseButton = read<HTMLButtonElement>('[data-action="pause"]');
    const cancelButton = read<HTMLButtonElement>('[data-action="cancel"]');
    const tiles = [...root.querySelectorAll<HTMLElement>('.umw-tile')].map((element) =>
      createDomMotionBinding(element, scope),
    );
    const result = createDomMotionBinding(read('.umw-result'), scope);
    const listeners = new AbortController();
    scope.defer(() => listeners.abort());
    let timeline: TimelineHandle | undefined;
    let disposed = false;
    let userPaused = false;
    const observeVisibility =
      options.suspendWhenOffscreen !== false && typeof IntersectionObserver !== 'undefined';
    // Hold new work until the observer supplies the first viewport measurement.
    let inViewport = !observeVisibility;
    let observer: IntersectionObserver | undefined;
    const live = () =>
      Boolean(timeline && !['completed', 'cancelled', 'failed'].includes(timeline.status));

    function readTimingDraft(): MotionWidgetTiming {
      const patch: Partial<MotionWidgetTiming> = {};
      for (const input of timingInputs)
        patch[input.dataset.timing as keyof MotionWidgetTiming] = input.valueAsNumber;
      return resolveWidgetTiming(patch);
    }

    function syncTimingDraft(): void {
      try {
        draftDuration.textContent = `${widgetDurationMs(readTimingDraft()).toLocaleString('en-US')} ms`;
      } catch {
        draftDuration.textContent = 'Enter valid milliseconds';
      }
    }

    function showTiming(): void {
      for (const input of timingInputs)
        input.value = String(timing[input.dataset.timing as keyof MotionWidgetTiming]);
      syncTimingDraft();
    }

    function showSpeed(): void {
      const rate = motion.playbackRate;
      const custom = ![0.5, 1, 2].includes(rate);
      customSpeed.hidden = !custom;
      customSpeed.disabled = !custom;
      customSpeed.value = custom ? String(rate) : '';
      customSpeed.textContent = custom ? `${rate}× · Custom` : '';
      speed.value = String(rate);
    }

    function notifySettings(): void {
      try {
        options.onSettingsChange?.(
          Object.freeze({
            timing: Object.freeze({ ...timing }),
            playbackRate: motion.playbackRate,
          }),
        );
      } catch {
        // Persistence observers must not interrupt committed motion settings.
      }
    }

    function sync(): void {
      if (disposed) return;
      const lifecycle = ctx.getLifecycleSnapshot().state;
      const running = lifecycle === 'running';
      const editable = running || lifecycle === 'paused';
      presetJson.disabled = !editable;
      exportButton.disabled = !editable;
      importButton.disabled = !editable;
      speed.disabled = !running && lifecycle !== 'paused';
      status.textContent =
        running && live() && !inViewport && !userPaused
          ? 'offscreen'
          : (timeline?.status ?? 'idle');
      progress.value = timeline?.progress ?? 0;
      const elapsed = Math.round(timeline?.currentTimeMs ?? 0).toLocaleString('en-US');
      const duration = (timeline?.durationMs ?? widgetDurationMs(timing)).toLocaleString('en-US');
      time.textContent = `${elapsed} / ${duration} ms`;
      const seekDuration = live() ? timeline!.durationMs : widgetDurationMs(timing);
      scrubber.disabled =
        (!running && lifecycle !== 'paused') || api.reducedMotion || seekDuration === 0;
      scrubber.value = String(Math.round((timeline?.progress ?? 0) * 1000));
      scrubber.setAttribute('aria-valuetext', `${elapsed} of ${duration} milliseconds`);
      timingFields.disabled = !running;
      replayButton.disabled = !running;
      pauseButton.disabled = !running || !live();
      pauseButton.textContent = userPaused ? 'Resume sequence' : 'Pause sequence';
      cancelButton.disabled = !live();
      try {
        options.onChange?.();
      } catch {
        // Host observation must not interrupt the widget's playback or controls.
      }
    }

    function syncVisibility(): void {
      if (disposed) return;
      // Group suspension composes with individual timeline and kernel pauses.
      if (inViewport) motion.resume();
      else motion.pause();
      root.dataset.offscreen = String(!inViewport);
      visibility.textContent = !observeVisibility
        ? 'Offscreen suspension disabled'
        : inViewport
          ? 'Pauses automatically offscreen'
          : 'Offscreen · position retained';
      sync();
    }

    function deactivate(): void {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      userPaused = false;
      timeline?.cancel('widget-disposed');
      timeline = undefined;
      listeners.abort();
      root.inert = true;
    }

    async function play(paused = false): Promise<MotionResult> {
      timeline?.cancel('replaced');
      userPaused = paused;
      for (const tile of tiles) tile.set({ opacity: 0, y: 20 });
      result.set({ opacity: 0 });
      const { entranceMs, staggerMs, revealMs } = timing;
      const revealAtMs = entranceMs + staggerMs * (tiles.length - 1);
      timeline = motion.timeline({
        tweens: [
          ...stagger(
            // Preserve the original fade lead while scaling the whole entrance.
            tiles.map((tile) =>
              fade({ durationMs: entranceMs * (5 / 7), onUpdate: tile.property('opacity') }),
            ),
            staggerMs,
          ),
          ...stagger(
            tiles.map((tile) =>
              slide({ from: 20, durationMs: entranceMs, onUpdate: tile.property('y') }),
            ),
            staggerMs,
          ),
          fade({ atMs: revealAtMs, durationMs: revealMs, onUpdate: result.property('opacity') }),
        ],
        onUpdate: sync,
      });
      const current = timeline;
      if (paused) current.pause();
      message.textContent = 'Three entrances, then one final reveal.';
      sync();
      const outcome = await current.finished;
      if (!disposed && current === timeline) {
        message.textContent =
          outcome.status === 'completed'
            ? 'Sequence complete. Make it move again.'
            : `Sequence ${outcome.status}. Replay starts a fresh sequence.`;
        sync();
      }
      return outcome;
    }

    const widget: MotionWidget = {
      async replay() {
        if (disposed || ctx.signal.aborted || ctx.getLifecycleSnapshot().state !== 'running')
          return { status: 'cancelled', reason: 'widget-unavailable' };
        return play();
      },
      seek(timeMs) {
        if (disposed || ctx.signal.aborted) return;
        if (!Number.isFinite(timeMs)) throw new RangeError('Widget seek time must be finite.');
        if (!['running', 'paused'].includes(ctx.getLifecycleSnapshot().state) || api.reducedMotion)
          return;
        const duration = live() ? timeline!.durationMs : widgetDurationMs(timing);
        if (duration === 0) return;
        if (!live())
          void play(true).catch((error: unknown) => {
            if (!disposed) message.textContent = String(error);
          });
        userPaused = true;
        timeline!.pause();
        timeline!.seek(timeMs);
        message.textContent = 'Sequence paused at the selected time. Resume sequence to continue.';
        sync();
      },
      setTiming(patch) {
        if (disposed) return;
        const next = resolveWidgetTiming(patch, timing);
        const changed =
          next.entranceMs !== timing.entranceMs ||
          next.staggerMs !== timing.staggerMs ||
          next.revealMs !== timing.revealMs;
        timing = next;
        showTiming();
        sync();
        if (changed) notifySettings();
      },
      setPlaybackRate(rate) {
        if (disposed) return;
        const previous = motion.playbackRate;
        motion.setPlaybackRate(rate);
        showSpeed();
        sync();
        if (previous !== rate) notifySettings();
      },
      exportPreset() {
        return serializeWidgetPreset({ timing, playbackRate: motion.playbackRate });
      },
      importPreset(json) {
        if (disposed || ctx.signal.aborted) return;
        const next = parseWidgetPreset(json);
        const changed =
          next.timing.entranceMs !== timing.entranceMs ||
          next.timing.staggerMs !== timing.staggerMs ||
          next.timing.revealMs !== timing.revealMs ||
          next.playbackRate !== motion.playbackRate;
        // Validate the whole preset before committing, then notify the host once.
        motion.setPlaybackRate(next.playbackRate);
        timing = { ...next.timing };
        showTiming();
        showSpeed();
        sync();
        if (changed) notifySettings();
      },
      pause() {
        if (disposed || !live()) return;
        userPaused = true;
        timeline?.pause();
        sync();
      },
      resume() {
        if (disposed) return;
        userPaused = false;
        timeline?.resume();
        sync();
      },
      cancel() {
        if (disposed) return;
        userPaused = false;
        timeline?.cancel('user');
        sync();
      },
      getSnapshot: () =>
        Object.freeze({
          status: disposed ? 'disposed' : (timeline?.status ?? 'idle'),
          progress: timeline?.progress ?? 0,
          offscreen: !disposed && !inViewport,
          userPaused,
          timing: Object.freeze({ ...timing }),
          currentTimeMs: timeline?.currentTimeMs ?? 0,
          durationMs: timeline?.durationMs ?? widgetDurationMs(timing),
          playbackRate: motion.playbackRate,
        }),
      teardown() {
        deactivate();
        return scope.dispose();
      },
    };
    const signal = ctx.signal;
    scope.defer(() => signal.removeEventListener('abort', deactivate));
    signal.addEventListener('abort', deactivate, { once: true });
    scope.defer(ctx.subscribeLifecycle(sync));
    scope.defer(api.subscribeReducedMotion(sync));
    scope.defer(deactivate);
    for (const button of [exportButton, importButton]) {
      button.addEventListener(
        'click',
        () => {
          if (disposed) return;
          try {
            if (button === exportButton) {
              presetJson.value = widget.exportPreset();
              presetJson.focus();
              presetJson.select();
              presetMessage.textContent = 'Preset ready. Copy the JSON to another widget.';
            } else {
              widget.importPreset(presetJson.value);
              presetMessage.textContent =
                'Settings imported. Timing applies on next replay; speed applies now.';
            }
            presetJson.setAttribute('aria-invalid', 'false');
            presetMessage.dataset.error = 'false';
          } catch (error) {
            presetJson.setAttribute('aria-invalid', 'true');
            presetMessage.dataset.error = 'true';
            presetMessage.textContent = error instanceof Error ? error.message : String(error);
          }
        },
        { signal: listeners.signal },
      );
    }
    scrubber.addEventListener(
      'input',
      () => {
        try {
          const duration = live() ? timeline!.durationMs : widgetDurationMs(timing);
          widget.seek((Number(scrubber.value) / 1000) * duration);
        } catch (error) {
          if (!disposed) message.textContent = String(error);
          sync();
        }
      },
      { signal: listeners.signal },
    );
    speed.addEventListener(
      'change',
      () => {
        try {
          widget.setPlaybackRate(Number(speed.value));
        } catch (error) {
          showSpeed();
          if (!disposed) message.textContent = String(error);
        }
      },
      { signal: listeners.signal },
    );
    for (const input of timingInputs)
      input.addEventListener('input', syncTimingDraft, { signal: listeners.signal });
    for (const action of ['apply', 'reset']) {
      read<HTMLButtonElement>(`[data-action="${action}"]`).addEventListener(
        'click',
        () => {
          if (disposed || timingFields.disabled) return;
          if (action === 'apply' && timingInputs.some((input) => !input.reportValidity())) return;
          try {
            widget.setTiming(action === 'reset' ? defaultWidgetTiming : readTimingDraft());
            void widget.replay().catch((error: unknown) => {
              if (!disposed) message.textContent = String(error);
            });
          } catch (error) {
            message.textContent = String(error);
          }
        },
        { signal: listeners.signal },
      );
    }
    for (const button of [replayButton, pauseButton, cancelButton]) {
      button.addEventListener(
        'click',
        () => {
          if (button === replayButton) {
            void widget.replay().catch((error: unknown) => {
              if (!disposed) message.textContent = String(error);
            });
          } else if (button === cancelButton) widget.cancel();
          else if (userPaused) widget.resume();
          else widget.pause();
        },
        { signal: listeners.signal },
      );
    }
    if (signal.aborted) throw new Error('Cannot mount a widget in an aborted runtime.');
    showTiming();
    showSpeed();
    host.append(root);
    syncVisibility();
    if (observeVisibility) {
      observer = new IntersectionObserver((entries) => {
        if (disposed) return;
        const latest = entries[entries.length - 1];
        if (!latest) return;
        inViewport = latest.isIntersecting;
        syncVisibility();
      });
      observer.observe(root);
    }
    return widget;
  } catch (error) {
    await scope.dispose();
    throw error;
  }
}
