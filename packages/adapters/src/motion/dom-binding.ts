/**
 * Company: EonHive Inc. | Title: DOM Motion Binding
 * Purpose: Compose numeric DOM properties and restore borrowed styles with an owning scope.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { ResourceScope } from '@urk/core';

export interface DomMotionValues {
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

export interface DomMotionBinding {
  set(values: Partial<DomMotionValues>): void;
  property(key: keyof DomMotionValues): (value: number) => void;
  getSnapshot(): Readonly<DomMotionValues>;
  dispose(): void;
}

const defaults: Readonly<DomMotionValues> = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };

function validate(values: Partial<DomMotionValues>): void {
  for (const [key, value] of Object.entries(values)) {
    if (!Object.prototype.hasOwnProperty.call(defaults, key))
      throw new TypeError(`Unsupported DOM motion property: ${key}`);
    if (!Number.isFinite(value)) throw new RangeError('DOM motion values must be finite.');
    if (key === 'opacity' && (value < 0 || value > 1))
      throw new RangeError('DOM opacity must be between zero and one.');
    if (key === 'scale' && value < 0) throw new RangeError('DOM scale must be nonnegative.');
  }
}

/** Own only inline opacity/transform; use the same scope for binding and playback. */
export function createDomMotionBinding(
  element: HTMLElement,
  scope: ResourceScope,
  initial: Partial<DomMotionValues> = {},
): DomMotionBinding {
  validate(initial);
  const style = element.style;
  const original = ['opacity', 'transform'].map((key) => ({
    key,
    value: style.getPropertyValue(key),
    priority: style.getPropertyPriority(key),
  }));
  let values = { ...defaults, ...initial };
  let disposed = false;

  function render(): void {
    style.setProperty('opacity', String(values.opacity));
    style.setProperty(
      'transform',
      `translate(${values.x}px, ${values.y}px) rotate(${values.rotate}deg) scale(${values.scale})`,
    );
  }

  const binding: DomMotionBinding = {
    set(patch) {
      if (disposed) return;
      validate(patch);
      values = { ...values, ...patch };
      render();
    },
    property(key) {
      if (!Object.prototype.hasOwnProperty.call(defaults, key))
        throw new TypeError(`Unsupported DOM motion property: ${key}`);
      return (value) => binding.set({ [key]: value });
    },
    getSnapshot: () => Object.freeze({ ...values }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { key, value, priority } of original) {
        if (value) style.setProperty(key, value, priority);
        else style.removeProperty(key);
      }
    },
  };
  // Register before rendering: a closed scope must reject without changing DOM.
  scope.defer(binding.dispose);
  try {
    render();
  } catch (error) {
    binding.dispose();
    throw error;
  }
  return binding;
}
