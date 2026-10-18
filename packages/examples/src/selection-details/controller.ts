/**
 * Company: EonHive Inc.
 * Title: Selection Details Pattern
 * Purpose: Share cancellable details loading and panel ownership between two views.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

import type { RuntimeContext } from '@urk/core';
import { UiOverlayCapability, type UiOverlayHandle } from '@urk/adapters/ui-overlay';
import { LoadingCapability } from '@urk/adapters/loading';

export interface SelectionItem { id: string; title: string }
export type DetailsLoader = (item: SelectionItem, signal: AbortSignal) => Promise<string>;

export function createSelectionDetails(ctx: RuntimeContext, options: {
  load: DetailsLoader;
  select(item: SelectionItem): void;
  act(item: SelectionItem): boolean;
  isActive(item: SelectionItem): boolean;
  actionLabel: string;
}) {
  const overlay = ctx.require(UiOverlayCapability);
  const loading = ctx.require(LoadingCapability);
  const status = overlay.open({ id: 'selection-status', kind: 'status', message: 'Choose an item.', placement: 'top-start' });
  const callout = overlay.open({ id: 'selection-callout', kind: 'callout', title: 'Selection details',
    body: 'Closing details keeps your selection.', placement: 'top-end' });
  let selected: SelectionItem | undefined;
  let panel: UiOverlayHandle<'panel'> | undefined;
  let reload: (() => void) | undefined;
  let stopped = false;
  let failNext = false;

  function select(item: SelectionItem): void {
    if (stopped || ctx.signal.aborted) return;
    if (selected?.id === item.id && panel && !panel.closed) return;
    selected = item;
    options.select(item);
    panel?.close();
    callout.update({ title: item.title, body: 'Selected. Close details without clearing this selection.', tone: 'selected' });
    panel = overlay.open({ id: 'selection-details', kind: 'panel', title: item.title, placement: 'bottom-end',
      mount(container) {
        const message = document.createElement('p');
        message.dataset.detailsMessage = '';
        message.setAttribute('role', 'status');
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = options.actionLabel;
        action.setAttribute('aria-pressed', String(options.isActive(item)));
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry details';
        retry.hidden = true;
        container.append(message, action, retry);
        let closed = false;
        let version = 0;
        let request: AbortController | undefined;
        const cancel = (): void => {
          version++;
          const pending = request;
          request = undefined;
          if (!pending) return;
          pending.abort();
          if (!ctx.signal.aborted) loading.complete('Details request cancelled');
        };
        ctx.signal.addEventListener('abort', cancel, { once: true });

        async function load(): Promise<void> {
          cancel();
          const current = version;
          const pending = new AbortController();
          request = pending;
          const failed = failNext;
          failNext = false;
          message.textContent = 'Loading details…';
          container.setAttribute('aria-busy', 'true');
          // Keep the retry control focusable while its request is pending.
          retry.textContent = 'Retrying…';
          retry.setAttribute('aria-disabled', 'true');
          action.disabled = true;
          const progress = loading.begin([{ id: 'details', label: 'Load details' }], 'Loading details…');
          status.update({ message: progress.message, progress: progress.progress });
          const isCurrent = (): boolean => !closed && !ctx.signal.aborted && !pending.signal.aborted && current === version;
          try {
            if (failed) throw new Error('Deliberate details-load failure.');
            const description = await options.load(item, pending.signal);
            if (!isCurrent()) return;
            request = undefined;
            message.textContent = description;
            action.disabled = false;
            container.setAttribute('aria-busy', 'false');
            const complete = loading.complete('Details ready');
            status.update({ message: complete.message, progress: complete.progress });
            if (container.ownerDocument.activeElement === retry) action.focus({ preventScroll: true });
            retry.hidden = true;
          } catch {
            if (!isCurrent()) return;
            request = undefined;
            loading.complete('Details request finished without content');
            message.textContent = 'Details could not load. Try again.';
            status.update({ message: 'Details unavailable. Your selection is preserved.', progress: null });
            container.setAttribute('aria-busy', 'false');
            retry.textContent = 'Retry details';
            retry.removeAttribute('aria-disabled');
            retry.hidden = false;
          }
        }

        reload = (): void => { if (!closed && !ctx.signal.aborted) void load(); };
        const onRetry = (): void => { if (!request) reload?.(); };
        const onAction = (): void => {
          if (closed || ctx.signal.aborted || action.disabled) return;
          action.setAttribute('aria-pressed', String(options.act(item)));
        };
        retry.addEventListener('click', onRetry);
        action.addEventListener('click', onAction);
        void load();
        return () => {
          closed = true;
          cancel();
          reload = undefined;
          ctx.signal.removeEventListener('abort', cancel);
          retry.removeEventListener('click', onRetry);
          action.removeEventListener('click', onAction);
          container.replaceChildren();
        };
      },
    });
  }

  // Observe the completed close, after the adapter knows whether it is disposing.
  const unsubscribe = overlay.subscribe(() => {
    if (stopped || ctx.signal.aborted || overlay.getSnapshot().destroyed || !panel?.closed) return;
    panel = undefined;
    if (!status.closed) status.update({ message: 'Details closed. Your selection is preserved.', progress: null });
  });
  ctx.scope.defer(() => {
    stopped = true;
    unsubscribe();
    panel?.close();
    callout.close();
    status.close();
  });
  return {
    select,
    getSelected: () => selected,
    retryWithFailure() {
      if (stopped || ctx.signal.aborted || !selected) return;
      failNext = true;
      if (panel && !panel.closed) reload?.();
      else select(selected);
    },
  };
}
