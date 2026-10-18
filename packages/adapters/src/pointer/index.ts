/**
 * Company: EonHive Inc.
 * Title: Pointer Adapter
 * Purpose: Normalize pointer target binding and emit interaction events.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-22
 * Notes: Vibe coded with Codex.
 */

import { token, type AdapterRegistration } from '@urk/core';

export interface PointerTargetDefinition {
  id: string;
  element: HTMLElement;
  meta?: Record<string, unknown>;
}

export interface PointerTargetEventPayload {
  targetId: string;
  element: HTMLElement;
  meta?: Record<string, unknown>;
  nativeEvent: MouseEvent | PointerEvent;
}

export interface PointerSurfaceDefinition {
  id: string;
  element: HTMLElement;
  meta?: Record<string, unknown>;
}

export interface PointerSurfaceEventPayload {
  surfaceId: string;
  element: HTMLElement;
  meta?: Record<string, unknown>;
  clientX: number;
  clientY: number;
  localX: number;
  localY: number;
  nativeEvent: MouseEvent | PointerEvent;
}

export interface PointerAdapterApi {
  bindTarget(target: PointerTargetDefinition): () => void;
  bindSurface(surface: PointerSurfaceDefinition): () => void;
  clear(): void;
}

function getSurfaceCoordinates(
  element: HTMLElement,
  nativeEvent: MouseEvent | PointerEvent,
): {
  clientX: number;
  clientY: number;
  localX: number;
  localY: number;
} {
  const bounds = element.getBoundingClientRect();

  return {
    clientX: nativeEvent.clientX,
    clientY: nativeEvent.clientY,
    localX: nativeEvent.clientX - bounds.left,
    localY: nativeEvent.clientY - bounds.top,
  };
}

export const PointerCapability = token<PointerAdapterApi>('pointer');

export function createPointerAdapter(
  id = 'pointer-adapter',
): AdapterRegistration<PointerAdapterApi> {
  return {
    id,
    capability: 'pointer',
    token: PointerCapability,
    setup(ctx) {
      const cleanups = new Map<string, () => void>();
      ctx.scope.defer(() => cleanups.clear());

      const emit = <TPayload>(type: string, payload: TPayload): void => {
        if (ctx.signal.aborted) return;
        ctx.events.emit({
          type,
          source: id,
          payload,
          timestamp: Date.now(),
        });
      };

      return {
        bindTarget(target) {
          if (ctx.signal.aborted) throw new Error('Pointer adapter is disposed.');
          if (cleanups.has(target.id)) {
            throw new Error(`Pointer target already bound: ${target.id}`);
          }

          const onEnter = (nativeEvent: PointerEvent): void => {
            emit('pointer:hover', {
              targetId: target.id,
              element: target.element,
              meta: target.meta,
              nativeEvent,
            });
          };

          const onLeave = (nativeEvent: PointerEvent): void => {
            emit('pointer:leave', {
              targetId: target.id,
              element: target.element,
              meta: target.meta,
              nativeEvent,
            });
          };

          const onSelect = (nativeEvent: MouseEvent): void => {
            emit('pointer:select', {
              targetId: target.id,
              element: target.element,
              meta: target.meta,
              nativeEvent,
            });
          };

          let bound = true;
          const cleanup = (): void => {
            if (!bound) return;
            bound = false;
            cleanups.delete(target.id);
            target.element.removeEventListener('pointerenter', onEnter);
            target.element.removeEventListener('pointerleave', onLeave);
            target.element.removeEventListener('click', onSelect);
          };
          ctx.scope.defer(cleanup);
          cleanups.set(target.id, cleanup);
          try {
            target.element.addEventListener('pointerenter', onEnter);
            target.element.addEventListener('pointerleave', onLeave);
            target.element.addEventListener('click', onSelect);
          } catch (error) {
            cleanup();
            throw error;
          }
          return cleanup;
        },
        bindSurface(surface) {
          if (ctx.signal.aborted) throw new Error('Pointer adapter is disposed.');
          const cleanupKey = `surface:${surface.id}`;

          if (cleanups.has(cleanupKey)) {
            throw new Error(`Pointer surface already bound: ${surface.id}`);
          }

          const onMove = (nativeEvent: PointerEvent): void => {
            emit('pointer:surface-move', {
              surfaceId: surface.id,
              element: surface.element,
              meta: surface.meta,
              ...getSurfaceCoordinates(surface.element, nativeEvent),
              nativeEvent,
            } satisfies PointerSurfaceEventPayload);
          };

          const onLeave = (nativeEvent: PointerEvent): void => {
            emit('pointer:surface-leave', {
              surfaceId: surface.id,
              element: surface.element,
              meta: surface.meta,
              ...getSurfaceCoordinates(surface.element, nativeEvent),
              nativeEvent,
            } satisfies PointerSurfaceEventPayload);
          };

          const onSelect = (nativeEvent: MouseEvent): void => {
            emit('pointer:surface-select', {
              surfaceId: surface.id,
              element: surface.element,
              meta: surface.meta,
              ...getSurfaceCoordinates(surface.element, nativeEvent),
              nativeEvent,
            } satisfies PointerSurfaceEventPayload);
          };

          let bound = true;
          const cleanup = (): void => {
            if (!bound) return;
            bound = false;
            cleanups.delete(cleanupKey);
            surface.element.removeEventListener('pointermove', onMove);
            surface.element.removeEventListener('pointerleave', onLeave);
            surface.element.removeEventListener('click', onSelect);
          };
          ctx.scope.defer(cleanup);
          cleanups.set(cleanupKey, cleanup);
          try {
            surface.element.addEventListener('pointermove', onMove);
            surface.element.addEventListener('pointerleave', onLeave);
            surface.element.addEventListener('click', onSelect);
          } catch (error) {
            cleanup();
            throw error;
          }
          return cleanup;
        },
        clear() {
          for (const cleanup of cleanups.values()) {
            cleanup();
          }

          cleanups.clear();
        },
      };
    },
  };
}
