/**
 * Company: EonHive Inc.
 * Title: Controller Template
 * Purpose: Generate a standalone URK ControllerRegistration scaffold.
 * Author: Stan Nesi
 * Created: 2026-05-05
 * Updated: 2026-05-05
 * Notes: Vibe coded with Codex.
 */

import { toCamelCase } from '../utils/names.js';

export type ControllerTemplateOptions = {
  name: string;
};

export type ControllerTemplateResult = {
  fileName: string;
  exportName: string;
  content: string;
};

/**
 * Generate a controller file that uses the real URK ControllerRegistration lifecycle shape.
 */
export function createControllerTemplate(
  options: ControllerTemplateOptions,
): ControllerTemplateResult {
  const createdAt = new Date().toISOString().slice(0, 10);
  const exportName = `${toCamelCase(options.name)}Controller`;
  const controllerId = `${options.name}-controller`;
  const fileName = `${options.name}.controller.ts`;

  return {
    fileName,
    exportName,
    content: `/**
 * Company: EonHive Inc.
 * Title: ${exportName}
 * Purpose: Provide a small URK controller scaffold with event-driven lifecycle hooks.
 * Author: Stan Nesi
 * Created: ${createdAt}
 * Updated: ${createdAt}
 * Notes: Vibe coded with Codex.
 */

import type {
  ControllerRegistration,
  RuntimeContext,
  RuntimeSnapshot,
} from '@urk/core';

const controllerId = '${controllerId}';

function emitControllerEvent(
  ctx: RuntimeContext,
  type: string,
  payload: Record<string, unknown> = {},
): void {
  /**
   * The event bus is where runtime events are emitted. Tools, adapters, and proof UIs can
   * observe these events without this controller needing direct references to them.
   */
  ctx.events.emit({
    type,
    source: controllerId,
    payload: {
      id: controllerId,
      ...payload,
    },
    timestamp: Date.now(),
  });
}

export const ${exportName}: ControllerRegistration = {
  id: controllerId,

  /**
   * init runs after the controller is registered and before start. The ctx argument is the
   * RuntimeContext: it holds runtime state, adapter APIs, services, the controller registry,
   * the event bus, and the frame scheduler for this kernel instance.
   */
  init(ctx: RuntimeContext): void {
    emitControllerEvent(ctx, 'controller:init');
  },

  /**
   * start runs after init when the kernel is ready to begin controller work. Use this hook for
   * setup that depends on registered capabilities. Track acquired cleanup with ctx.scope.defer.
   * Use ctx.signal for cancellable asynchronous work.
   */
  start(ctx: RuntimeContext): void {
    emitControllerEvent(ctx, 'controller:start');
  },

  // Add update(frame, ctx) only when this controller needs continuous frame work.

  /**
   * onStateChange runs whenever the runtime phase snapshot changes. RuntimeSnapshot means the
   * runtime state at one moment, including the current phase, optional reason, and update time.
   */
  onStateChange(
    next: RuntimeSnapshot,
    previous: RuntimeSnapshot,
    ctx: RuntimeContext,
  ): void {
    emitControllerEvent(ctx, 'controller:phase-change', {
      nextPhase: next.phase,
      previousPhase: previous.phase,
      reason: next.reason,
    });
  },

  /**
   * dispose runs during kernel shutdown. Release any controller-owned listeners, timers, or
   * handles here. This scaffold only emits a lifecycle event because it owns no resources yet.
   */
  dispose(ctx: RuntimeContext): void {
    emitControllerEvent(ctx, 'controller:dispose');
  },
};
`,
  };
}
