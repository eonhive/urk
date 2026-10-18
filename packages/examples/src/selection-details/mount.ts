/**
 * Company: EonHive Inc.
 * Title: Selection Details Experiences
 * Purpose: Prove one controller pattern in a scene-like surface and an ordinary webpage.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type Kernel } from '@urk/core';
import { createUiOverlayAdapter } from '@urk/adapters/ui-overlay';
import { createLoadingAdapter } from '@urk/adapters/loading';
import { createPointerAdapter, PointerCapability, type PointerTargetEventPayload } from '@urk/adapters/pointer';
import { createSelectionDetails, type DetailsLoader } from './controller.js';
import { createSelectionView, items, type SelectionMode } from './view.js';

export function mountSelectionProof(host: HTMLElement, mode: SelectionMode, options: { load?: DetailsLoader } = {}): {
  kernel: Kernel; ready: Promise<void>; teardown(): Promise<void>;
} {
  const root = createSelectionView(mode);
  host.append(root);
  const overlayHost = root.querySelector<HTMLElement>('[data-overlay-host]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-select]')];
  const message = root.querySelector<HTMLElement>('[data-example-message]')!;
  const kernel = createKernel({
    frameMode: 'auto', services: { 'ui:host': overlayHost },
    adapters: [createUiOverlayAdapter(), createLoadingAdapter(), createPointerAdapter()],
    controllers: [{
      id: 'selection-details',
      start(ctx) {
        const highlights = new Set<string>();
        const details = createSelectionDetails(ctx, {
          load: options.load ?? (async (item, signal) => {
            const { descriptions } = await import('./content.js');
            if (signal.aborted) throw new DOMException('Selection changed.', 'AbortError');
            return descriptions[item.id];
          }),
          select(item) {
            root.dataset.selected = item.id;
            root.querySelector('[data-selected-label]')!.textContent = `Selected: ${item.title}`;
            for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.select === item.id));
            ctx.events.emit({ type: 'scene-ui:node-selected', source: 'selection-details', timestamp: Date.now(), payload: { id: item.id } });
          },
          actionLabel: mode === 'scene' ? 'Highlight node' : 'Feature project',
          isActive: item => highlights.has(item.id),
          act(item) {
            if (highlights.has(item.id)) highlights.delete(item.id);
            else highlights.add(item.id);
            buttons.find(button => button.dataset.select === item.id)!.dataset.highlight = String(highlights.has(item.id));
            message.textContent = `${item.title} ${highlights.has(item.id) ? 'highlighted' : 'restored'}.`;
            return highlights.has(item.id);
          },
        });
        const pointer = ctx.require(PointerCapability);
        for (const button of buttons) pointer.bindTarget({ id: button.dataset.select!, element: button });
        ctx.scope.defer(ctx.events.on('pointer:select', event => {
          const payload = event.payload as PointerTargetEventPayload;
          const item = items.find(entry => entry.id === payload.targetId);
          if (item) details.select(item);
        }));
        const onClick = (event: Event): void => {
          if (ctx.signal.aborted) return;
          const button = (event.target as Element).closest<HTMLButtonElement>('button');
          if (!button) return;
          if (button.hasAttribute('data-theme-toggle')) {
            const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
            root.dataset.theme = theme;
            overlayHost.dataset.urkUiTheme = theme;
            button.textContent = theme === 'dark' ? 'Use light theme' : 'Use dark theme';
          } else if (button.hasAttribute('data-compact-toggle')) {
            root.dataset.compact = String(root.dataset.compact !== 'true');
            button.setAttribute('aria-pressed', root.dataset.compact);
          } else if (button.hasAttribute('data-fail-details')) details.retryWithFailure();
        };
        root.addEventListener('click', onClick);
        ctx.scope.defer(() => root.removeEventListener('click', onClick));
        ctx.scope.defer(() => { for (const button of root.querySelectorAll('button')) button.disabled = true; });
        details.select(items[0]);
        ctx.state.setPhase('ready', 'selection:ready');
      },
    }],
  });
  const ready = kernel.boot();
  void ready.catch(error => { message.textContent = `The example could not start: ${error instanceof Error ? error.message : 'Unknown error'}`; });
  let teardown: Promise<void> | undefined;
  return {
    kernel, ready,
    teardown() {
      teardown ??= kernel.shutdown().finally(() => root.remove());
      return teardown;
    },
  };
}

export function mountProjectSelectionExample(host: HTMLElement) {
  return mountSelectionProof(host, 'projects');
}
