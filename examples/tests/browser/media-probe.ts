/**
 * Company: EonHive Inc. | Title: Browser Media Resource Probe
 * Purpose: Observe real media cleanup and deliberately delayed native playback completion.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import type { Page } from '@playwright/test';

export async function observeMedia(page: Page) {
  await page.addInitScript(() => {
    const probe = {
      videos: new Set<HTMLVideoElement>(),
      audio: new Set<HTMLAudioElement>(),
      audioListeners: new Map<EventTarget, Set<EventListenerOrEventListenerObject>>(),
      holdAudio: false,
      audioHeld: 0,
      releaseAudio: [] as Array<() => void>,
      listeners: new Map<EventTarget, Set<EventListenerOrEventListenerObject>>(),
      urls: new Set<string>(),
      frames: new Set<number>(),
      hold: false,
      held: 0,
      release: [] as Array<() => void>,
    };
    Object.assign(window, { videoProbe: probe });
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (this instanceof HTMLVideoElement && listener) {
        probe.videos.add(this);
        if (!probe.listeners.has(this)) probe.listeners.set(this, new Set());
        probe.listeners.get(this)!.add(listener);
      }
      if (this instanceof HTMLAudioElement && listener) {
        probe.audio.add(this);
        if (!probe.audioListeners.has(this)) probe.audioListeners.set(this, new Set());
        probe.audioListeners.get(this)!.add(listener);
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (listener) {
        probe.listeners.get(this)?.delete(listener);
        probe.audioListeners.get(this)?.delete(listener);
      }
      return remove.call(this, type, listener, options);
    };
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (value) => {
      const url = create(value);
      probe.urls.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      probe.urls.delete(url);
      revoke(url);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const native = play.call(this);
      if (this instanceof HTMLAudioElement && probe.holdAudio) {
        return native.then(
          () =>
            new Promise<void>((resolve) => {
              probe.audioHeld++;
              probe.releaseAudio.push(() => {
                probe.audioHeld--;
                resolve();
              });
            }),
        );
      }
      if (!probe.hold) return native;
      return native.then(
        () =>
          new Promise<void>((resolve) => {
            probe.held++;
            probe.release.push(() => {
              probe.held--;
              resolve();
            });
          }),
      );
    };
    const frame = requestAnimationFrame.bind(window),
      cancel = cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      const id = frame((time) => {
        probe.frames.delete(id);
        callback(time);
      });
      probe.frames.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      probe.frames.delete(id);
      cancel(id);
    };
  });
}

export async function resources(page: Page) {
  return page.evaluate(() => {
    const probe = (window as any).videoProbe;
    return {
      urls: probe.urls.size,
      frames: probe.frames.size,
      playing: [...probe.videos].filter((video: any) => !video.paused).length,
      sources: [...probe.videos].filter((video: any) => video.hasAttribute('src')).length,
      listeners: [...probe.listeners.values()].reduce(
        (count: number, set: any) => count + set.size,
        0,
      ),
    };
  });
}

export async function audioResources(page: Page) {
  return page.evaluate(() => {
    const probe = (window as any).videoProbe;
    return {
      frames: probe.frames.size,
      playing: [...probe.audio].filter((audio: any) => !audio.paused).length,
      sources: [...probe.audio].filter((audio: any) => audio.getAttribute('src')).length,
      listeners: [...probe.audioListeners.values()].reduce(
        (count: number, set: any) => count + set.size,
        0,
      ),
    };
  });
}
