/**
 * Company: EonHive Inc.
 * Title: UI Widgets Adapter
 * Purpose: Mount a small overlay shell with status and callout surfaces.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-15
 * Notes: Vibe coded with Codex.
 */

import { token, type AdapterRegistration } from '@urk/core';
import { createOverlays } from '../ui-overlay/overlays.js';
import type { UiOverlayManagerApi } from '../ui-overlay/types.js';

export interface UiWidgetCallout {
  title: string;
  body: string;
  tone?: 'neutral' | 'active' | 'selected';
}

export interface UiWidgetsAdapterApi extends UiOverlayManagerApi {
  setStatus(message: string): void;
  showCallout(callout: UiWidgetCallout): void;
  hideCallout(): void;
  destroy(): void;
}

function assertHtmlElement(value: unknown, serviceName: string): HTMLElement {
  if (typeof HTMLElement === 'undefined' || !(value instanceof HTMLElement)) {
    throw new Error(`Service ${serviceName} must be an HTMLElement.`);
  }

  return value;
}

export const UiWidgetsCapability = token<UiWidgetsAdapterApi>('ui-widgets');

export function createUiWidgetsAdapter(
  id = 'ui-widgets-adapter',
): AdapterRegistration<UiWidgetsAdapterApi> {
  return {
    id,
    capability: 'ui-widgets',
    token: UiWidgetsCapability,
    setup(ctx) {
      const host = assertHtmlElement(ctx.services.require('ui:host'), 'ui:host');
      const root = document.createElement('div');
      let overlays: ReturnType<typeof createOverlays> | undefined;
      let destroyed = false;
      const destroy = (): void => {
        if (destroyed) return;
        destroyed = true;
        try { overlays?.destroy(); } finally { root.remove(); }
      };
      ctx.scope.defer(destroy);
      const status = document.createElement('div');
      const callout = document.createElement('div');
      const title = document.createElement('div');
      const body = document.createElement('div');

      root.dataset.urkOverlay = '';
      status.dataset.overlayStatus = '';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-atomic', 'true');
      callout.dataset.overlayCallout = '';
      callout.setAttribute('role', 'note');

      root.style.position = 'absolute';
      root.style.inset = '0';
      root.style.pointerEvents = 'none';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.justifyContent = 'space-between';
      root.style.padding = '16px';
      root.style.boxSizing = 'border-box';
      root.style.gap = '12px';

      status.style.alignSelf = 'flex-start';
      status.style.padding = '8px 12px';
      status.style.borderRadius = '999px';
      status.style.background = 'var(--urk-ui-background, var(--urk-overlay-status-background, rgba(15, 23, 42, 0.82)))';
      status.style.color = 'var(--urk-ui-foreground, var(--urk-overlay-foreground, #f8fafc))';
      status.style.fontSize = '13px';
      status.style.fontWeight = '600';
      status.style.letterSpacing = '0.02em';
      status.style.backdropFilter = 'blur(12px)';
      status.style.maxWidth = '100%';
      status.style.overflowWrap = 'anywhere';

      callout.style.alignSelf = 'flex-end';
      callout.style.maxWidth = '280px';
      callout.style.boxSizing = 'border-box';
      callout.style.overflowWrap = 'anywhere';
      callout.style.padding = '14px 16px';
      callout.style.borderRadius = 'var(--urk-ui-radius, 18px)';
      callout.style.background = 'var(--urk-ui-background, var(--urk-overlay-background))';
      callout.style.color = 'var(--urk-ui-foreground, var(--urk-overlay-foreground))';
      callout.style.boxShadow = '0 20px 45px rgba(15, 23, 42, 0.22)';
      callout.style.backdropFilter = 'blur(12px)';
      callout.style.display = 'none';

      title.style.fontSize = '14px';
      title.style.fontWeight = '700';
      title.style.marginBottom = '6px';

      body.style.fontSize = '13px';
      body.style.lineHeight = '1.5';
      body.style.opacity = '0.92';

      callout.append(title, body);
      root.append(status, callout);
      host.append(root);
      overlays = createOverlays(root, ctx.signal);

      const applyTone = (tone: UiWidgetCallout['tone'] = 'neutral'): void => {
        const palette = {
          neutral: 'var(--urk-ui-background, var(--urk-overlay-background))',
          active: 'var(--urk-ui-active, var(--urk-overlay-active))',
          selected: 'var(--urk-ui-selected, var(--urk-overlay-selected))',
        } as const;

        callout.style.background = palette[tone];
      };

      return {
        ...overlays,
        setStatus(message) {
          if (destroyed || ctx.signal.aborted) return;
          if (status.textContent !== message) status.textContent = message;
        },
        showCallout(config) {
          if (destroyed || ctx.signal.aborted) return;
          callout.setAttribute('aria-label', config.title);
          title.textContent = config.title;
          body.textContent = config.body;
          callout.style.display = 'block';
          applyTone(config.tone);
        },
        hideCallout() {
          if (destroyed || ctx.signal.aborted) return;
          callout.style.display = 'none';
        },
        destroy,
      };
    },
  };
}
