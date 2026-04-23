/**
 * Company: EonHive Inc.
 * Title: UI Widgets Adapter
 * Purpose: Mount a small overlay shell with status and callout surfaces.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-15
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration } from '@urk/core';

export interface UiWidgetCallout {
  title: string;
  body: string;
  tone?: 'neutral' | 'active' | 'selected';
}

export interface UiWidgetsAdapterApi {
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

export function createUiWidgetsAdapter(
  id = 'ui-widgets-adapter',
): AdapterRegistration<UiWidgetsAdapterApi> {
  return {
    id,
    capability: 'ui-widgets',
    setup(ctx) {
      const host = assertHtmlElement(ctx.services.require('ui:host'), 'ui:host');
      const root = document.createElement('div');
      const status = document.createElement('div');
      const callout = document.createElement('div');
      const title = document.createElement('div');
      const body = document.createElement('div');

      root.style.position = 'absolute';
      root.style.inset = '0';
      root.style.pointerEvents = 'none';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.justifyContent = 'space-between';
      root.style.padding = '16px';

      status.style.alignSelf = 'flex-start';
      status.style.padding = '8px 12px';
      status.style.borderRadius = '999px';
      status.style.background = 'rgba(15, 23, 42, 0.82)';
      status.style.color = '#f8fafc';
      status.style.fontSize = '13px';
      status.style.fontWeight = '600';
      status.style.letterSpacing = '0.02em';
      status.style.backdropFilter = 'blur(12px)';

      callout.style.alignSelf = 'flex-end';
      callout.style.maxWidth = '280px';
      callout.style.padding = '14px 16px';
      callout.style.borderRadius = '18px';
      callout.style.background = 'rgba(15, 23, 42, 0.92)';
      callout.style.color = '#f8fafc';
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

      const applyTone = (tone: UiWidgetCallout['tone'] = 'neutral'): void => {
        const palette = {
          neutral: 'rgba(15, 23, 42, 0.92)',
          active: 'rgba(14, 116, 144, 0.92)',
          selected: 'rgba(22, 101, 52, 0.94)',
        } as const;

        callout.style.background = palette[tone];
      };

      return {
        setStatus(message) {
          status.textContent = message;
        },
        showCallout(config) {
          title.textContent = config.title;
          body.textContent = config.body;
          callout.style.display = 'block';
          applyTone(config.tone);
        },
        hideCallout() {
          callout.style.display = 'none';
        },
        destroy() {
          root.remove();
        },
      };
    },
    dispose(_ctx, api) {
      api.destroy();
    },
  };
}
