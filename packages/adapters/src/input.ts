/**
 * Company: EonHive Inc.
 * Title: Input Adapter
 * Purpose: Normalize keyboard input into a small reusable runtime capability.
 * Author: Stan Nesi
 * Created: 2026-04-20
 * Updated: 2026-04-20
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration, RuntimeContext } from '@urk/core';

export type InputEventPhase = 'down' | 'up';

export interface InputKeyEvent {
  code: string;
  key: string;
  phase: InputEventPhase;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  nativeEvent: KeyboardEvent;
}

export interface InputBinding {
  code: string;
  phase?: InputEventPhase;
  allowRepeat?: boolean;
  handler: (event: InputKeyEvent) => void;
}

export type InputListener = (event: InputKeyEvent) => void;

export interface InputAdapterApi {
  isPressed(code: string): boolean;
  bindKey(binding: InputBinding): () => void;
  subscribe(listener: InputListener): () => void;
  clear(): void;
}

type InputTarget = Window | Document | HTMLElement;

type BoundInputBinding = {
  code: string;
  phase: InputEventPhase;
  allowRepeat: boolean;
  handler: (event: InputKeyEvent) => void;
};

function resolveInputTarget(ctx: RuntimeContext): InputTarget {
  const serviceTarget = ctx.services.get<unknown>('input:target');

  if (serviceTarget === undefined) {
    return window;
  }

  if (serviceTarget === window) {
    return window;
  }

  if (typeof Document !== 'undefined' && serviceTarget instanceof Document) {
    return serviceTarget;
  }

  if (typeof HTMLElement !== 'undefined' && serviceTarget instanceof HTMLElement) {
    return serviceTarget;
  }

  throw new Error('Service input:target must be a Window, Document, or HTMLElement.');
}

function createInputEvent(
  phase: InputEventPhase,
  nativeEvent: KeyboardEvent,
): InputKeyEvent {
  return {
    code: nativeEvent.code || nativeEvent.key,
    key: nativeEvent.key,
    phase,
    repeat: nativeEvent.repeat,
    altKey: nativeEvent.altKey,
    ctrlKey: nativeEvent.ctrlKey,
    metaKey: nativeEvent.metaKey,
    shiftKey: nativeEvent.shiftKey,
    nativeEvent,
  };
}

export function createInputAdapter(
  id = 'input-adapter',
): AdapterRegistration<InputAdapterApi> {
  let disposeTargetListeners: (() => void) | null = null;

  return {
    id,
    capability: 'input',
    isSupported() {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    },
    setup(ctx) {
      const target = resolveInputTarget(ctx);
      const resetTarget = window;
      const pressedCodes = new Set<string>();
      const bindings = new Set<BoundInputBinding>();
      const listeners = new Set<InputListener>();

      const publish = (event: InputKeyEvent): void => {
        ctx.events.emit({
          type: event.phase === 'down' ? 'input:key-down' : 'input:key-up',
          source: id,
          payload: event,
          timestamp: Date.now(),
        });

        for (const listener of [...listeners]) {
          listener(event);
        }

        for (const binding of [...bindings]) {
          if (binding.code !== event.code || binding.phase !== event.phase) {
            continue;
          }

          if (event.repeat && !binding.allowRepeat) {
            continue;
          }

          binding.handler(event);
        }
      };

      const onKeyDown = (nativeEvent: Event): void => {
        if (!(nativeEvent instanceof KeyboardEvent)) {
          return;
        }

        const event = createInputEvent('down', nativeEvent);
        pressedCodes.add(event.code);
        publish(event);
      };

      const onKeyUp = (nativeEvent: Event): void => {
        if (!(nativeEvent instanceof KeyboardEvent)) {
          return;
        }

        const event = createInputEvent('up', nativeEvent);
        pressedCodes.delete(event.code);
        publish(event);
      };

      const onBlur = (): void => {
        pressedCodes.clear();
      };

      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      resetTarget.addEventListener('blur', onBlur);

      // Keep the public API minimal while still ensuring dispose can tear down DOM listeners.
      disposeTargetListeners = () => {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
        resetTarget.removeEventListener('blur', onBlur);
      };

      return {
        isPressed(code) {
          return pressedCodes.has(code);
        },
        bindKey(binding) {
          const normalizedBinding: BoundInputBinding = {
            code: binding.code,
            phase: binding.phase ?? 'down',
            allowRepeat: binding.allowRepeat ?? false,
            handler: binding.handler,
          };

          bindings.add(normalizedBinding);

          return () => {
            bindings.delete(normalizedBinding);
          };
        },
        subscribe(listener) {
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
        clear() {
          pressedCodes.clear();
          bindings.clear();
          listeners.clear();
        },
      };
    },
    dispose(_ctx, api) {
      disposeTargetListeners?.();
      disposeTargetListeners = null;
      api.clear();
    },
  };
}
