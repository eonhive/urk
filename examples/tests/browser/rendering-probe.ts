/**
 * Company: EonHive Inc.
 * Title: Rendering Browser Probe
 * Purpose: Observe real canvas pixels and owned frame, resize, and context listeners in browser tests.
 * Author: Stan Nesi
 * Created: 2026-10-13
 * Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import type { Page } from '@playwright/test';

export async function observeScene(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = {
      frames: new Set<number>(), pixels: 0, observers: new Set<ResizeObserver>(),
      contextListeners: new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>(),
      pointerListeners: new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>(),
      detailsListeners: new Map<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>(),
      resolutionListeners: new Map<MediaQueryList, Set<EventListenerOrEventListenerObject>>(),
    };
    Object.assign(window, { renderingProbe: probe });
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => {
        probe.frames.delete(id);
        callback(time);
        // Inspect pixels in the draw task, before WebGL discards its back buffer.
        const gl = document.querySelector('canvas')?.getContext('webgl2');
        probe.pixels = 0;
        if (!gl || gl.isContextLost()) return;
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) probe.pixels++;
      });
      probe.frames.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { probe.frames.delete(id); cancel(id); };
    const NativeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeObserver {
      observe(element: Element, options?: ResizeObserverOptions): void { probe.observers.add(this); super.observe(element, options); }
      disconnect(): void { probe.observers.delete(this); super.disconnect(); }
    };
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (this instanceof HTMLElement && this.matches('[data-urk-owned="v02"] .selection-details, [data-urk-owned="v02"] [data-wireframe]') &&
          (type === 'keydown' || type === 'change') && listener) {
        let types = probe.detailsListeners.get(this);
        if (!types) probe.detailsListeners.set(this, types = new Map());
        let listeners = types.get(type);
        if (!listeners) types.set(type, listeners = new Set());
        listeners.add(listener);
      }
      if (this instanceof HTMLElement && this.matches('[data-urk-owned="v02"] .viewport, [data-urk-owned="v02"] [data-card]') &&
          (type.startsWith('pointer') || type === 'click' || type === 'lostpointercapture') && listener) {
        let types = probe.pointerListeners.get(this);
        if (!types) probe.pointerListeners.set(this, types = new Map());
        let listeners = types.get(type);
        if (!listeners) types.set(type, listeners = new Set());
        listeners.add(listener);
      }
      if (this instanceof MediaQueryList && this.media.includes('resolution:') && type === 'change' && listener) {
        let listeners = probe.resolutionListeners.get(this);
        if (!listeners) probe.resolutionListeners.set(this, listeners = new Set());
        listeners.add(listener);
      }
      // Track long-lived canvas listeners; one-shot test-driver listeners release natively.
      if (this instanceof HTMLCanvasElement && type.startsWith('webglcontext') && listener && !(typeof options === 'object' && options.once)) {
        let types = probe.contextListeners.get(this);
        if (!types) probe.contextListeners.set(this, types = new Map());
        let listeners = types.get(type);
        if (!listeners) types.set(type, listeners = new Set());
        listeners.add(listener);
      }
      add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (listener) probe.detailsListeners.get(this)?.get(type)?.delete(listener);
      if (listener) probe.pointerListeners.get(this)?.get(type)?.delete(listener);
      if (listener) probe.contextListeners.get(this)?.get(type)?.delete(listener);
      if (listener && this instanceof MediaQueryList) probe.resolutionListeners.get(this)?.delete(listener);
      remove.call(this, type, listener, options);
    };
  });
}
