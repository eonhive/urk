/**
 * Company: EonHive Inc.
 * Title: Input Adapter
 * Purpose: Normalize keyboard input into a small reusable runtime capability.
 * Author: Stan Nesi
 * Created: 2026-04-20
 * Updated: 2026-04-20
 * Notes: Vibe coded with Codex.
 */

import { token, type AdapterRegistration, type RuntimeContext } from '@urk/core';

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

export const InputCapability = token<InputAdapterApi>('input');

export function createInputAdapter(
  id = 'input-adapter',
): AdapterRegistration<InputAdapterApi> {
  return {
    id,
    capability: 'input',
    token: InputCapability,
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
        if (ctx.signal.aborted || !(nativeEvent instanceof KeyboardEvent)) {
          return;
        }

        const event = createInputEvent('down', nativeEvent);
        pressedCodes.add(event.code);
        publish(event);
      };

      const onKeyUp = (nativeEvent: Event): void => {
        if (ctx.signal.aborted || !(nativeEvent instanceof KeyboardEvent)) {
          return;
        }

        const event = createInputEvent('up', nativeEvent);
        pressedCodes.delete(event.code);
        publish(event);
      };

      const onBlur = (): void => {
        pressedCodes.clear();
      };

      ctx.scope.defer(() => {
        pressedCodes.clear();
        bindings.clear();
        listeners.clear();
      });
      const listen = (element: EventTarget, type: string, listener: EventListener): void => {
        ctx.scope.defer(() => element.removeEventListener(type, listener));
        element.addEventListener(type, listener);
      };
      listen(target, 'keydown', onKeyDown);
      listen(target, 'keyup', onKeyUp);
      listen(resetTarget, 'blur', onBlur);
      listen(document, 'visibilitychange', () => {
        if (document.hidden) pressedCodes.clear();
      });
      if (target instanceof HTMLElement) {
        listen(target, 'focusout', event => {
          const next = (event as FocusEvent).relatedTarget;
          if (!(next instanceof Node) || !target.contains(next)) pressedCodes.clear();
        });
      }
      listen(ctx.signal, 'abort', onBlur);

      return {
        isPressed(code) {
          return pressedCodes.has(code);
        },
        bindKey(binding) {
          if (ctx.signal.aborted) throw new Error('Input adapter is disposed.');
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
          if (ctx.signal.aborted) throw new Error('Input adapter is disposed.');
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
  };
}
