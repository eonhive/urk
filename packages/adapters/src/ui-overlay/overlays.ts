/**
 * Company: EonHive Inc.
 * Title: Owned DOM Overlays
 * Purpose: Manage instance-local overlay content, observation, and cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */

import { CleanupError } from '@urk/core';
import { overlayStyles } from './styles.js';
import type {
  UiOverlayHandle, UiOverlayKind, UiOverlayManagerApi, UiOverlayOptions,
  UiOverlayPlacement, UiOverlaySnapshot, UiOverlayState, UiOverlayUpdate,
} from './types.js';

const placements: UiOverlayPlacement[] = ['top-start', 'top-end', 'bottom-start', 'bottom-end'];

interface OverlayRecord {
  options: UiOverlayOptions;
  element: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  progress: HTMLProgressElement;
  cleanups: Array<() => void>;
  returnFocus: Element | null;
  ready: boolean;
  closed: boolean;
}

function validate(options: UiOverlayOptions): void {
  if (typeof options.id !== 'string' || !options.id.trim()) throw new Error('Overlay ID must be nonempty.');
  if (options.placement !== undefined && !placements.includes(options.placement)) throw new Error('Unknown overlay placement.');
  if (options.kind === 'status') {
    if (typeof options.message !== 'string') throw new Error('Status message must be text.');
    if (options.progress != null && (!Number.isFinite(options.progress) || options.progress < 0 || options.progress > 1)) {
      throw new Error('Overlay progress must be between 0 and 1.');
    }
    return;
  }
  if (typeof options.title !== 'string') throw new Error('Overlay title must be text.');
  if (options.kind === 'callout') {
    if (typeof options.body !== 'string') throw new Error('Callout body must be text.');
    if (options.tone !== undefined && !['neutral', 'active', 'selected'].includes(options.tone)) throw new Error('Unknown callout tone.');
    return;
  }
  if (options.kind !== 'panel' || typeof options.mount !== 'function') throw new Error('A panel requires a mount function.');
}

function stateOf({ options }: OverlayRecord): UiOverlayState {
  const base = { id: options.id, placement: options.placement ?? 'top-start' };
  switch (options.kind) {
    case 'status': return Object.freeze({ ...base, kind: 'status', message: options.message, progress: options.progress ?? null });
    case 'callout': return Object.freeze({ ...base, kind: 'callout', title: options.title, body: options.body, tone: options.tone ?? 'neutral' });
    case 'panel': return Object.freeze({ ...base, kind: 'panel', title: options.title });
  }
}

export function createOverlays(root: HTMLElement, signal: AbortSignal): UiOverlayManagerApi & { destroy(): void } {
  const document = root.ownerDocument;
  const records = new Map<string, OverlayRecord>();
  const subscribers = new Set<() => void>();
  let destroyed = false;
  let snapshot: UiOverlaySnapshot = Object.freeze({ revision: 0, destroyed, overlays: Object.freeze([]) });
  const layer = document.createElement('div');
  layer.className = 'urk-overlay-layer';
  const style = document.createElement('style');
  style.textContent = overlayStyles;
  const slotsRoot = document.createElement('div');
  slotsRoot.className = 'urk-overlay-slots';
  const slots = new Map(placements.map(placement => {
    const slot = document.createElement('div');
    slot.className = 'urk-overlay-slot';
    slot.dataset.placement = placement;
    slotsRoot.append(slot);
    return [placement, slot] as const;
  }));
  layer.append(slotsRoot);
  root.append(style, layer);
  const inputEvents = ['click', 'dblclick', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
    'mousedown', 'mouseup', 'keydown', 'keyup', 'wheel', 'touchstart', 'touchend', 'touchmove'];
  const isolatePanelInput = (event: Event): void => {
    if (event.composedPath().some(target => target instanceof HTMLElement &&
        target.classList.contains('urk-overlay-item') && target.dataset.kind === 'panel')) event.stopPropagation();
  };
  for (const type of inputEvents) root.addEventListener(type, isolatePanelInput, { passive: true });

  function assertActive(): void {
    if (destroyed || signal.aborted) throw new Error('UI overlay adapter is disposed.');
  }

  function publish(): void {
    const overlays = Object.freeze([...records.values()].filter(record => record.ready).map(stateOf));
    if (snapshot.destroyed === destroyed && JSON.stringify(snapshot.overlays) === JSON.stringify(overlays)) return;
    snapshot = Object.freeze({ revision: snapshot.revision + 1, destroyed, overlays });
    const current = snapshot;
    for (const listener of [...subscribers]) {
      if (snapshot !== current) break;
      if (!subscribers.has(listener)) continue;
      try { listener(); } catch { /* Observers cannot break overlay ownership. */ }
    }
  }

  function render(record: OverlayRecord): void {
    const { options, element, title, body, progress } = record;
    const slot = slots.get(options.placement ?? 'top-start')!;
    if (element.parentElement !== slot) {
      const focused = document.activeElement;
      const containedFocus = element.contains(focused);
      slot.append(element);
      // Reparenting can blur native inputs. Restore only focus lost by this move.
      if (containedFocus && !record.closed && !destroyed && !signal.aborted &&
          document.activeElement === document.body && focused instanceof HTMLElement && focused.isConnected) {
        focused.focus({ preventScroll: true });
      }
    }
    if (options.kind === 'status') {
      if (body.textContent !== options.message) body.textContent = options.message;
      if (progress.hidden !== (options.progress == null)) progress.hidden = options.progress == null;
      if (options.progress != null && (!progress.hasAttribute('value') || progress.value !== options.progress)) {
        progress.value = options.progress;
      }
      const label = options.message || 'Progress';
      if (progress.getAttribute('aria-label') !== label) progress.setAttribute('aria-label', label);
    } else {
      if (title.textContent !== options.title) title.textContent = options.title;
      if (element.getAttribute('aria-label') !== options.title) element.setAttribute('aria-label', options.title);
      if (options.kind === 'callout') {
        if (body.textContent !== options.body) body.textContent = options.body;
        const tone = options.tone ?? 'neutral';
        if (element.dataset.tone !== tone) element.dataset.tone = tone;
      }
    }
  }

  function close(record: OverlayRecord): void {
    if (record.closed) return;
    record.closed = true;
    if (records.get(record.options.id) === record) records.delete(record.options.id);
    const restoreFocus = record.element.contains(document.activeElement);
    const errors: unknown[] = [];
    for (const cleanup of record.cleanups.splice(0).reverse()) {
      try { cleanup(); } catch (error) { errors.push(error); }
    }
    record.element.remove();
    record.element.replaceChildren();
    // Never move focus that the application deliberately moved during cleanup.
    if (restoreFocus && document.activeElement === document.body && record.returnFocus?.isConnected &&
        record.returnFocus instanceof HTMLElement) record.returnFocus.focus({ preventScroll: true });
    publish();
    if (errors.length) throw new CleanupError(errors, 'Overlay content cleanup failed.');
  }

  function open<K extends UiOverlayKind>(input: UiOverlayOptions<K>): UiOverlayHandle<K> {
    assertActive();
    validate(input as UiOverlayOptions);
    if (records.has(input.id)) throw new Error(`Overlay already open: ${input.id}`);
    const options = { ...input } as UiOverlayOptions;
    const element = document.createElement('section');
    element.className = 'urk-overlay-item';
    element.dataset.overlayId = options.id;
    element.dataset.kind = options.kind;
    const title = document.createElement('h3');
    const body = document.createElement('p');
    const progress = document.createElement('progress');
    progress.max = 1;
    const record: OverlayRecord = {
      options, element, title, body, progress, cleanups: [], returnFocus: document.activeElement,
      ready: false, closed: false,
    };
    // Reserve before user mounting code can reenter open() or destroy().
    records.set(options.id, record);
    const handle: UiOverlayHandle<K> = {
      id: options.id,
      get closed() { return record.closed; },
      update(patch: UiOverlayUpdate<K>) {
        assertActive();
        if (record.closed) throw new Error(`Overlay is closed: ${options.id}`);
        const allowed = ['placement', ...(options.kind === 'status' ? ['message', 'progress'] :
          options.kind === 'callout' ? ['title', 'body', 'tone'] : ['title'])];
        if (Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Overlay update contains unsupported fields.');
        const next = { ...record.options, ...patch } as UiOverlayOptions;
        validate(next);
        record.options = next;
        render(record);
        publish();
      },
      close: () => close(record),
    };
    try {
      if (options.kind === 'status') {
        element.setAttribute('role', 'status');
        element.setAttribute('aria-atomic', 'true');
        element.append(body, progress);
      } else {
        element.setAttribute('role', options.kind === 'panel' ? 'region' : 'note');
        const heading = document.createElement('div');
        heading.className = 'urk-overlay-heading';
        heading.append(title);
        element.append(heading);
        if (options.kind === 'callout') element.append(body);
        else {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Close';
          button.setAttribute('aria-label', 'Close panel');
          heading.append(button);
          const onClose = (event: Event): void => {
            event.stopPropagation();
            if (!signal.aborted) handle.close();
          };
          button.addEventListener('click', onClose);
          record.cleanups.push(() => button.removeEventListener('click', onClose));
          const onKey = (event: KeyboardEvent): void => {
            event.stopPropagation();
            if (event.key !== 'Escape' || event.defaultPrevented || signal.aborted ||
                event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            event.preventDefault();
            handle.close();
          };
          element.addEventListener('keydown', onKey);
          record.cleanups.push(() => element.removeEventListener('keydown', onKey));
          const container = document.createElement('div');
          container.dataset.overlayContent = '';
          // Give text-only panels the same native keyboard scrolling as controls.
          container.tabIndex = 0;
          container.setAttribute('role', 'group');
          container.setAttribute('aria-label', 'Panel content');
          element.append(container);
          render(record);
          const cleanup = options.mount(container);
          if (cleanup !== undefined && typeof cleanup !== 'function') throw new Error('Panel mount must return a synchronous cleanup function.');
          // A mount may synchronously destroy its owner before returning its cleanup.
          if (record.closed || signal.aborted) {
            cleanup?.();
            throw new Error('Overlay closed during mount.');
          }
          if (cleanup) record.cleanups.push(cleanup);
        }
      }
      render(record);
      record.ready = true;
      publish();
      return handle;
    } catch (error) {
      try { close(record); } catch (cleanupError) { throw new CleanupError([error, cleanupError], 'Overlay mount and cleanup failed.'); }
      throw error;
    }
  }

  return {
    open,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (destroyed || signal.aborted) return () => {};
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      const errors: unknown[] = [];
      for (const record of [...records.values()].reverse()) {
        try { close(record); } catch (error) { errors.push(error); }
      }
      layer.remove();
      style.remove();
      // A content action can destroy its owner during event dispatch. Keep the root
      // boundary through that dispatch so the closing click never reaches the scene.
      queueMicrotask(() => {
        for (const type of inputEvents) root.removeEventListener(type, isolatePanelInput);
      });
      publish();
      subscribers.clear();
      if (errors.length) throw new CleanupError(errors, 'UI overlay cleanup failed.');
    },
  };
}
