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
  const exportName = `${toCamelCase(options.name)}Controller`;
  const controllerId = `${options.name}-controller`;
  const fileName = `${options.name}.controller.ts`;

  return {
    fileName,
    exportName,
    content: `/**
 * Company: EonHive Inc.
 * Title: ${exportName}
 * Purpose: Provide a small URK controller scaffold with every lifecycle hook documented.
 * Author: Stan Nesi
 * Created: 2026-05-05
 * Updated: 2026-05-05
 * Notes: Vibe coded with Codex.
 */

import type {
  ControllerRegistration,
  FrameInfo,
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
   * small setup that depends on registered adapter APIs or services already being available.
   */
  start(ctx: RuntimeContext): void {
    emitControllerEvent(ctx, 'controller:start');
  },

  /**
   * update runs on each scheduled frame. The frame argument is FrameInfo: timing metadata for
   * this tick, including elapsed time, delta time, and the frame number. Keep this hook cheap.
   *
   * The adapter registry is ctx.adapters. It is where adapter APIs are found when a controller
   * needs a capability such as loading, input, pointer, storage, or UI widgets.
   */
  update(frame: FrameInfo, ctx: RuntimeContext): void {
    const phase = ctx.state.getSnapshot().phase;

    if (phase !== 'ready' && phase !== 'loading') {
      return;
    }

    // The scaffold intentionally does no per-frame work yet. Use frame when this controller
    // needs lightweight timing behavior.
    void frame;
  },

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
