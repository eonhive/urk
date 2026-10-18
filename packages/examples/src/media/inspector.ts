/**
 * Company: EonHive Inc. | Title: Media Inspector View
 * Purpose: Present existing runtime and video snapshots only while diagnostics are open.
 * Author: Stan Nesi | Created: 2026-10-15 | Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */
import type { Kernel, RuntimeContext } from '@urk/core';
import { AudioCapability } from '@urk/adapters/audio';
import { VideoCapability } from '@urk/adapters/video';
import { mediaInspectorStyles } from './inspector-styles.js';

type ExperienceDetails = { scene: string; branch: string; cue: string; recovery: string; error: string };

export function mountMediaInspector(
  ctx: RuntimeContext,
  kernel: Kernel,
  button: HTMLButtonElement,
  host: HTMLElement,
  readExperience?: () => ExperienceDetails,
) {
  const panel = document.createElement('section');
  panel.className = 'urk-media-inspector';
  panel.id = `media-inspector-${ctx.id}`;
  panel.setAttribute('aria-label', 'Media diagnostics');
  panel.tabIndex = 0;
  panel.hidden = true;
  panel.innerHTML = `<h3>Runtime inspector <span>LIVE</span></h3>
    <dl data-inspector-runtime></dl><dl data-inspector-experience></dl>
    <h4>Media</h4><ul data-inspector-players></ul>
    <h4>Recent events</h4><ol data-inspector-events></ol>
    <p>Read-only. Event history covers observed intervals; closing releases observation.</p>`;
  const style = document.createElement('style');
  style.textContent = mediaInspectorStyles;
  panel.prepend(style);
  host.append(panel);
  const find = (selector: string) => panel.querySelector<HTMLElement>(selector)!;
  const runtime = find('[data-inspector-runtime]');
  const experience = find('[data-inspector-experience]');
  const players = find('[data-inspector-players]');
  const events = find('[data-inspector-events]');
  const inspector = kernel.getInspector();
  let observing = false;
  let offInspector = () => {};
  let offLifecycle = () => {};

  // Render public snapshot fields and event labels without retaining payloads or resource objects.
  function text(tag: string, value: string) {
    const element = document.createElement(tag);
    element.textContent = value.slice(0, 500);
    return element;
  }
  function details(list: HTMLElement, values: Array<[string, string]>) {
    list.replaceChildren(...values.flatMap(([label, value]) => [text('dt', label), text('dd', value)]));
  }
  function refresh() {
    if (!observing || ctx.signal.aborted) return;
    const snapshot = inspector.getSnapshot();
    details(runtime, [
      ['Lifecycle', kernel.getLifecycleSnapshot().state],
      ['Kernel frames', String(snapshot.frameCount)],
      ['Scheduler', snapshot.schedulerRunning ? 'Running' : 'Stopped'],
      ['Adapters', snapshot.adapters.map(item => item.id).join(', ') || 'None'],
      ['Controllers', snapshot.controllers.map(item => `${item.id} · ${item.started ? 'started' : 'initializing'}`).join(', ') || 'None'],
    ]);
    if (readExperience) {
      const state = readExperience();
      details(experience, [
        ['Scene', state.scene], ['Direction', state.branch], ['Last cue', state.cue],
        ['Recovery', state.recovery], ['Last failure', state.error],
      ]);
    }
    const videos = ctx.get(VideoCapability)?.getSnapshots() ?? [];
    players.replaceChildren(...videos.map(video => {
      const item = document.createElement('li');
      item.dataset.playerId = video.id;
      const values = document.createElement('dl');
      const duration = video.duration === null ? '—' : Number.isFinite(video.duration) ? video.duration.toFixed(1) : 'Live';
      details(values, [
        ['State', video.seeking ? `${video.status} · seeking` : video.status],
        ['Media time', `${video.currentTime.toFixed(1)} / ${duration}`],
        ['Captions', video.textTracks.filter(track => track.mode === 'showing').map(track => track.label).join(', ') || 'Off'],
        ['Error', video.error ? `${video.error.name}: ${video.error.message}` : 'None'],
      ]);
      item.append(text('strong', video.id), values);
      return item;
    }));
    const audio = ctx.get(AudioCapability);
    if (audio) {
      const state = audio.getSnapshot();
      players.append(text('li', `Audio: ${state.activeTrackId ?? 'No track'} · ${state.status} · ${Math.round(state.volume * 100)}% volume${state.muted ? ' · muted' : ''} · analysis ${audio.analysis.enabled ? 'enabled' : 'disabled'}`));
    }
    if (!videos.length && !audio) players.append(text('li', 'No registered media.'));
    events.replaceChildren(...snapshot.recentEvents.slice(-8).reverse().map(event =>
      text('li', `${event.type} · ${event.source}`)));
    if (!snapshot.recentEvents.length) events.append(text('li', 'Waiting for events.'));
  }
  function close() {
    observing = false;
    offInspector();
    offLifecycle();
    offInspector = offLifecycle = () => {};
    panel.hidden = true;
    for (const list of [runtime, experience, players, events]) list.replaceChildren();
    button.textContent = 'Show diagnostics';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-pressed', 'false');
  }
  function toggle() {
    if (observing) { close(); return; }
    if (ctx.signal.aborted) return;
    observing = true;
    panel.hidden = false;
    button.textContent = 'Hide diagnostics';
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-pressed', 'true');
    offInspector = inspector.subscribe(refresh);
    offLifecycle = kernel.subscribeLifecycle(refresh);
    refresh();
  }
  function cancel() {
    close();
    button.disabled = true;
  }
  button.setAttribute('aria-controls', panel.id);
  button.disabled = ctx.signal.aborted;
  close();
  button.addEventListener('click', toggle);
  ctx.signal.addEventListener('abort', cancel, { once: true });
  ctx.scope.defer(() => {
    cancel();
    button.removeEventListener('click', toggle);
    ctx.signal.removeEventListener('abort', cancel);
    panel.remove();
  });
  return { refresh };
}
