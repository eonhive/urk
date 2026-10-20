/**
 * Company: EonHive Inc. | Title: Docs Audio Widget Host
 * Purpose: Add and remove the shared audio widget without owning another runtime.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { AudioCapability } from '@urk/adapters/audio';
import { mountAudioWidget, type AudioWidget } from '../audio-widget/index.js';

export function mountDocsAudio(host: HTMLElement, ctx: RuntimeContext): void {
  if (ctx.signal.aborted) return;
  const audio = ctx.get(AudioCapability);
  const root = document.createElement('section');
  root.className = 'docs-audio';
  root.setAttribute('aria-label', 'Optional audio study');
  root.innerHTML = `
    <style>
      .docs-audio { margin-top:20px; padding-top:20px; border-top:1px solid #52617c; min-width:0; }
      .docs-audio > h3 { color:inherit; font-size:20px; margin:0 0 8px; }
      .docs-audio > p { font-size:13px; color:#cbd5e1; line-height:1.6; }
      .docs-audio-toggle { font:inherit; font-size:13px; border:1px solid #52617c; border-radius:8px; padding:9px 12px; color:#e7edf9; background:#18233b; cursor:pointer; }
      .docs-audio-toggle:disabled { opacity:.45; cursor:default; }
      .docs-audio-toggle:focus-visible { outline:3px solid #b0a8ff; outline-offset:3px; }
      .docs-audio > [role=status] { min-height:1.5em; }
    </style>
    <h3>Listen and react</h3>
    <p>Add an audio study, then press Play to see its waveform, spectrum, and pulse.
      Remove it whenever you want; the motion widget stays available.</p>
    <button type="button" class="docs-audio-toggle" aria-pressed="false" disabled>Add audio widget</button>
    <p role="status">Audio is optional. Nothing plays when this page opens.</p>
    <div class="docs-audio-host"></div>`;
  ctx.scope.defer(() => root.remove());
  host.append(root);
  const toggle = root.querySelector<HTMLButtonElement>('button')!;
  const status = root.querySelector<HTMLElement>('[role=status]')!;
  const widgetHost = root.querySelector<HTMLElement>('.docs-audio-host')!;
  const events = new AbortController();
  let widget: AudioWidget | undefined;
  let registered = false;
  let closed = false;
  let pending: Promise<void> | undefined;
  const running = () => ctx.getLifecycleSnapshot().state === 'running';

  const sync = () => {
    if (closed) return;
    const state = ctx.getLifecycleSnapshot().state;
    toggle.textContent = widget ? 'Remove audio widget' : 'Add audio widget';
    toggle.setAttribute('aria-pressed', String(Boolean(widget)));
    toggle.disabled = !audio || Boolean(pending) ||
      (widget ? state !== 'running' && state !== 'paused' : !running());
  };
  const close = () => {
    closed = true;
    events.abort();
    toggle.disabled = true;
  };
  ctx.signal.addEventListener('abort', close, { once: true });
  ctx.scope.defer(async () => {
    close();
    ctx.signal.removeEventListener('abort', close);
    await widget?.teardown();
    await pending;
    widget = undefined;
  });
  ctx.scope.defer(ctx.subscribeLifecycle(sync));

  async function changeWidget(): Promise<void> {
    if (closed || !audio) return;
    if (widget) {
      const previous = widget;
      widget = undefined;
      await previous.teardown();
      if (closed) return;
      status.textContent = 'Audio widget removed. You can add it again when ready.';
      return;
    }
    if (!running()) return;
    // Register once: remounting reuses the transport's cached source/context binding.
    if (!registered) {
      audio.registerTrack({
        id: 'docs-study', label: 'Docs three-band study',
        src: new URL('/audio/analysis.wav', document.baseURI).href, loop: true,
      });
      registered = true;
      audio.setVolume(0.6);
    }
    const next = await mountAudioWidget(widgetHost, ctx, {
      trackId: 'docs-study', title: 'Docs audio signal',
    });
    if (closed || !running()) {
      await next.teardown();
      return;
    }
    widget = next;
    status.textContent = 'Audio widget added. Press Play to start the study.';
  }

  toggle.addEventListener('click', () => {
    if (toggle.disabled || closed) return;
    const restoreFocus = widgetHost.contains(document.activeElement);
    pending = changeWidget().catch(error => {
      if (!closed) status.textContent = `Audio could not be changed: ${String(error)}`;
    }).finally(() => {
      pending = undefined;
      sync();
      if (restoreFocus && !widget && !closed && !toggle.disabled)
        toggle.focus({ preventScroll: true });
    });
    sync();
  }, { signal: events.signal });
  if (!audio) status.textContent = 'Audio is unavailable in this browser. Motion remains available.';
  sync();
}
