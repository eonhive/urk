/**
 * Company: EonHive Inc. | Title: Embedded Audio Widget
 * Purpose: Control one existing audio transport and render analysis in a borrowed runtime and host.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import { ResourceScope, type RuntimeContext } from '@urk/core';
import { AudioCapability } from '@urk/adapters/audio';
import { observeAudioFrames } from './frames.js';
import { createAudioWidgetView } from './view.js';
import { mountAudioPosition } from './position.js';
import { mountAudioFiles } from './files.js';
import { mountAudioReactions, resolveAudioReactions, type AudioReactionSettings } from './reactions.js';

export type { AudioReactionSettings } from './reactions.js';
export { createAudioPlots, type AudioPlotOptions } from './plots.js';
export { mountAudioPreferences } from './preferences.js';

export interface AudioWidgetOptions {
  /** A track registered by the host on its audio adapter. */
  trackId: string;
  title?: string;
  /** Opt in to a local file picker; restore this registered source on reset/removal. */
  localFiles?: { defaultSource: string };
  /** Initial visual response only; reset always restores the 100% baseline. */
  reactions?: Partial<AudioReactionSettings>;
  /** Observe committed changes; the host owns storage and its opt-in policy. */
  onReactionsChange?: (settings: Readonly<AudioReactionSettings>) => void;
}

export interface AudioWidget {
  play(): Promise<void>;
  pause(): void;
  restart(): Promise<void>;
  getReactionSettings(): Readonly<AudioReactionSettings>;
  teardown(): Promise<void>;
}

/** One widget controls one adapter transport; the host owns tracks and adapter disposal. */
export async function mountAudioWidget(
  host: HTMLElement,
  ctx: RuntimeContext,
  options: AudioWidgetOptions,
): Promise<AudioWidget> {
  const trackId = options.trackId;
  if (!trackId.trim()) throw new TypeError('An audio track ID is required.');
  if (ctx.signal.aborted) throw new Error('Cannot mount audio in an aborted runtime.');
  const initialReactions = resolveAudioReactions(options.reactions);
  const scope = new ResourceScope();
  ctx.scope.defer(scope.dispose.bind(scope));
  try {
    const audio = ctx.require(AudioCapability);
    const view = createAudioWidgetView(options.title ?? 'Your audio signal');
    scope.defer(() => view.root.remove());
    host.append(view.root);
    const { get } = view;
    const status = get('status');
    const enabled = get<HTMLInputElement>('analysis');
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const listeners = new AbortController();
    scope.defer(() => listeners.abort());
    let disposed = false;
    let request = 0;
    let transportMessage: string | undefined;
    let latest = audio.analysis.read();
    const reactions = mountAudioReactions(get('reactions'), { ...ctx, scope }, settings => {
      if (!disposed) view.render(latest, preference.matches, settings);
    }, { initial: initialReactions, onChange: options.onReactionsChange });
    const refresh = observeAudioFrames({ ...ctx, scope }, snapshot => {
      latest = snapshot;
      if (!disposed) view.render(snapshot, preference.matches, reactions);
    });
    const live = () => !disposed && !ctx.signal.aborted && !document.hidden &&
      ctx.getLifecycleSnapshot().state === 'running';
    const settings = () => ({
      fftSize: Number(get<HTMLSelectElement>('fft').value),
      smoothing: Number(get<HTMLInputElement>('smoothing').value),
    });
    const syncControls = () => {
      if (disposed) return;
      const transport = audio.getSnapshot();
      for (const control of view.root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select')) {
        if (control.hasAttribute('data-audio-position') || control.hasAttribute('data-audio-file') ||
            control.hasAttribute('data-audio-reaction')) continue;
        control.disabled = !live();
      }
      get<HTMLButtonElement>('pause').disabled = !live() ||
        (transport.status !== 'playing' && transport.status !== 'loading');
      get('mute').textContent = transport.muted ? 'Unmute' : 'Mute';
      get('mute').setAttribute('aria-pressed', String(transport.muted));
      get<HTMLInputElement>('volume').value = String(transport.volume);
    };
    const report = (error: unknown) => {
      if (disposed || ctx.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
      status.textContent = error instanceof Error ? error.message : String(error);
      refresh();
      syncControls();
    };
    mountAudioPosition(get('position'), { ...ctx, scope }, report);
    if (options.localFiles) mountAudioFiles(get('files'), { ...ctx, scope }, {
      trackId, defaultSource: options.localFiles.defaultSource,
      onChange() { request++; },
    }, report);
    const play = async () => {
      if (!live()) return;
      const current = ++request;
      let analysisError: unknown;
      // Start both in the original gesture. Unsupported analysis leaves playback usable.
      const ready = enabled.checked
        ? audio.analysis.enable(settings()).catch(error => { analysisError = error; })
        : Promise.resolve();
      try {
        await Promise.all([ready, audio.play(trackId)]);
        if (disposed || ctx.signal.aborted || current !== request) return;
        if (analysisError) {
          enabled.checked = false;
          status.textContent = `Playing without analysis: ${String(analysisError)}`;
        }
        refresh();
      } catch (error) {
        if (disposed || ctx.signal.aborted || current !== request) return;
        throw error;
      } finally {
        syncControls();
      }
    };
    const pause = () => {
      if (disposed) return;
      request++;
      audio.pause();
    };
    const restart = () => {
      if (!live()) return Promise.resolve();
      request++;
      audio.stop();
      return play();
    };
    const deactivate = () => {
      if (disposed) return;
      disposed = true;
      request++;
      listeners.abort();
      // Borrowed transports stay registered and reusable after widget removal.
      const activeTrack = audio.getSnapshot().activeTrackId;
      if (activeTrack === trackId || activeTrack === null) {
        audio.stop();
        audio.analysis.disable();
      }
    };
    scope.defer(deactivate);
    ctx.signal.addEventListener('abort', deactivate, { once: true });
    scope.defer(() => ctx.signal.removeEventListener('abort', deactivate));
    scope.defer(audio.subscribe(transport => {
      if (disposed) return;
      const message = transport.errorMessage ?? `Audio ${transport.status}.`;
      if (transportMessage !== message) {
        status.textContent = message;
        transportMessage = message;
      }
      syncControls();
    }));
    scope.defer(ctx.subscribeLifecycle(state => {
      if (state.state !== 'running') pause();
      syncControls();
    }));
    const on = (target: EventTarget, event: string, action: () => void | Promise<void>) => {
      target.addEventListener(event, () => {
        if (disposed || ctx.signal.aborted) return;
        try { void Promise.resolve(action()).catch(report); }
        catch (error) { report(error); }
      }, { signal: listeners.signal });
    };
    on(get('play'), 'click', play);
    on(get('pause'), 'click', pause);
    on(get('restart'), 'click', restart);
    on(get('mute'), 'click', () => audio.setMuted(!audio.getSnapshot().muted));
    on(get('volume'), 'input', () => audio.setVolume(Number(get<HTMLInputElement>('volume').value)));
    on(enabled, 'change', async () => {
      const current = ++request;
      if (!enabled.checked) audio.analysis.disable();
      else if (['playing', 'loading'].includes(audio.getSnapshot().status)) {
        try { await audio.analysis.enable(settings()); }
        finally {
          if (!disposed && current === request) enabled.checked = audio.analysis.enabled;
        }
      }
      refresh();
    });
    on(get('fft'), 'change', () => { audio.analysis.configure(settings()); refresh(); });
    on(get('smoothing'), 'input', () => { audio.analysis.configure(settings()); refresh(); });
    on(preference, 'change', refresh);
    on(document, 'visibilitychange', () => {
      if (document.hidden) pause();
      syncControls();
    });
    syncControls();
    return {
      play, pause, restart,
      getReactionSettings() { return Object.freeze({ ...reactions }); },
      teardown() { deactivate(); return scope.dispose(); },
    };
  } catch (error) {
    await scope.dispose();
    throw error;
  }
}
