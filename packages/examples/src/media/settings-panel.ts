/**
 * Company: EonHive Inc.
 * Title: Media Settings Panel Pattern
 * Purpose: Reuse native media controls in one scoped nonmodal overlay at a time.
 * Author: Stan Nesi
 * Created: 2026-10-17
 * Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */

import type { RuntimeContext } from '@urk/core';
import { UiOverlayCapability, type UiOverlayHandle } from '@urk/adapters/ui-overlay';

export function mountMediaSettings(ctx: RuntimeContext, host: HTMLElement) {
  const ui = ctx.require(UiOverlayCapability);
  let active: { button: HTMLButtonElement; panel: UiOverlayHandle<'panel'> } | undefined;
  host.hidden = true;
  ctx.scope.defer(() => { active?.panel.close(); host.remove(); });

  return function bindSettings(options: {
    id: string;
    title: string;
    button: HTMLButtonElement;
    surface: HTMLElement;
    content: HTMLElement;
  }): void {
    const { button, surface, content } = options;
    const parking = content.parentElement!;
    if (!content.id) content.id = `${ctx.id}-${options.id}-content`;
    button.setAttribute('aria-controls', content.id);
    button.setAttribute('aria-expanded', 'false');
    content.hidden = true;

    const toggle = (): void => {
      if (ctx.signal.aborted || button.matches(':disabled')) return;
      if (active?.button === button) { active.panel.close(); return; }
      // Capture the deliberate opener before closing another player's panel.
      button.focus({ preventScroll: true });
      active?.panel.close();
      surface.append(host);
      host.hidden = false;
      try {
        const panel = ui.open({
          id: options.id, kind: 'panel', title: options.title, placement: 'top-end',
          mount(container) {
            content.hidden = false;
            container.append(content);
            button.setAttribute('aria-expanded', 'true');
            return () => {
              content.hidden = true;
              parking.append(content);
              button.setAttribute('aria-expanded', 'false');
              host.hidden = true;
              if (active?.button === button) active = undefined;
            };
          },
        });
        if (panel.closed || ctx.signal.aborted) return;
        active = { button, panel };
        // Prevent opening settings from scrolling its video out of view.
        const first = content.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)');
        (first ?? content.parentElement)?.focus({ preventScroll: true });
      } catch (error) {
        host.hidden = true;
        throw error;
      }
    };
    button.addEventListener('click', toggle);
    ctx.scope.defer(() => button.removeEventListener('click', toggle));
  };
}
