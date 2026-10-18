/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Playground Integration
 * Purpose: Verify shared interaction, persistence, idle rendering, and cleanup in real hosts.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const standalone = 'http://127.0.0.1:5174/v02/';

async function observeResources(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe = {
      audio: [] as HTMLAudioElement[], plays: 0, frames: new Set<number>(),
      observers: new Set<ResizeObserver>(), holdPlayback: false, pendingPlays: 0, releasePlayback: () => {},
    };
    Object.assign(window, { playgroundProbe: probe });
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src?: string) { super(src); probe.audio.push(this); }
      async play(): Promise<void> {
        probe.plays++;
        probe.pendingPlays++;
        try {
          if (probe.holdPlayback) await new Promise<void>(resolve => { probe.releasePlayback = resolve; });
          await super.play();
        } finally { probe.pendingPlays--; }
      }
    };
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      const id = request(time => { probe.frames.delete(id); callback(time); });
      probe.frames.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { probe.frames.delete(id); cancel(id); };
    const NativeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeObserver {
      observe(target: Element, options?: ResizeObserverOptions): void { probe.observers.add(this); super.observe(target, options); }
      disconnect(): void { probe.observers.delete(this); super.disconnect(); }
    };
  });
}

async function resourceState(page: Page) {
  return page.evaluate(() => {
    const probe = (window as any).playgroundProbe;
    return {
      plays: probe.plays as number,
      activeAudio: probe.audio.filter((audio: HTMLAudioElement) => !audio.paused).length,
      retainedAudio: probe.audio.filter((audio: HTMLAudioElement) => audio.getAttribute('src')).length,
      frames: probe.frames.size,
      observers: probe.observers.size,
    };
  });
}

for (const [host, url] of [
  ['standalone', standalone],
  ['React', 'http://127.0.0.1:5174/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: objects, keyboard, preferences, sound, idle rendering, and recovery`, async ({ page }) => {
    await observeResources(page);
    await page.goto(url);
    const lifecycle = page.getByTestId('v02-lifecycle');
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    await expect(lifecycle).toHaveText('running');
    await expect(page.getByTestId('v02-frames')).toHaveText('Idle');
    await expect(viewport.locator('canvas')).toBeVisible();
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    expect((await resourceState(page)).plays).toBe(0);

    // Picking the center object exercises Three's raycaster, not a DOM selection button.
    await viewport.click({ position: { x: (await viewport.boundingBox())!.width / 2, y: (await viewport.boundingBox())!.height / 2 } });
    await expect(page.locator('[data-card="Create"]')).toHaveAttribute('aria-pressed', 'true');
    await viewport.press('3');
    await expect(page.locator('[data-card="Connect"]')).toHaveAttribute('aria-pressed', 'true');
    await viewport.press('ArrowRight');
    await expect(viewport).toHaveAttribute('data-rotation', '0.20,0.50');
    await page.getByRole('button', { name: 'Show diagnostics' }).focus();
    await page.keyboard.press('1');
    await expect(viewport).toHaveAttribute('data-selected', 'Connect');
    await page.locator('[data-card="Create"]').click();
    await page.getByRole('slider', { name: 'Volume' }).fill('0.65');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('urk:v02:preferences')!))).toEqual({ selected: 'Create', volume: 0.65 });

    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await expect.poll(async () => (await resourceState(page)).plays).toBe(1);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(lifecycle).toHaveText('paused');
    await expect(page.locator('[data-card="Explore"]')).toBeDisabled();
    await expect(page.getByRole('slider', { name: 'Volume' })).toBeDisabled();
    await expect.poll(async () => (await resourceState(page)).activeAudio).toBe(0);
    const pausedRenders = await viewport.getAttribute('data-render-count');
    await viewport.press('2');
    await viewport.press('ArrowRight');
    await expect(viewport).toHaveAttribute('data-render-count', pausedRenders!);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(lifecycle).toHaveText('running');
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    expect((await resourceState(page)).plays).toBe(1);
    await page.getByRole('button', { name: 'Disable sound', exact: true }).click();
    await page.getByRole('button', { name: 'Show diagnostics' }).click();
    await expect(page.getByTestId('v02-diagnostics')).toContainText('0 frames');
    const idleRenders = await viewport.getAttribute('data-render-count');
    // An observation window is necessary to distinguish demand rendering from a loop.
    await page.waitForTimeout(180);
    await expect(viewport).toHaveAttribute('data-render-count', idleRenders!);
    expect((await resourceState(page)).frames).toBe(0);

    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(lifecycle).toHaveText('disposed');
    await expect(page.getByTestId('v02-owned')).toHaveText('0');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(() => resourceState(page)).toEqual({ plays: 1, activeAudio: 0, retainedAudio: 0, frames: 0, observers: 0 });
    await page.getByRole('button', { name: 'Start fresh' }).click();
    await expect(lifecycle).toHaveText('running');
    await expect(page.locator('[data-card="Create"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('0.65');
    await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
    expect((await resourceState(page)).plays).toBe(1);
    await page.reload();
    await expect(lifecycle).toHaveText('running');
    await expect(page.locator('[data-card="Create"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('0.65');
    expect((await resourceState(page)).plays).toBe(0);
    await page.getByRole('button', { name: 'Try setup failure' }).click();
    await expect(lifecycle).toHaveText('disposed');
    await expect(page.getByTestId('v02-owned')).toHaveText('0');
    await expect(page.getByTestId('v02-message')).toContainText('Deliberate setup failure');
    await page.getByRole('button', { name: 'Start fresh' }).click();
    await expect(lifecycle).toHaveText('running');
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(lifecycle).toHaveText('disposed');
    await expect.poll(() => resourceState(page)).toEqual({ plays: 0, activeAudio: 0, retainedAudio: 0, frames: 0, observers: 0 });
  });
}

test('coalesces drawing, cancels pending frames, and fits narrow screens', async ({ page }) => {
  await observeResources(page);
  await page.goto(standalone);
  const viewport = page.getByRole('group', { name: 'Interactive objects' });
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(viewport).toHaveAttribute('data-render-pending', 'false');
  const result = await viewport.evaluate(element => {
    const before = element.getAttribute('data-render-count');
    for (let index = 0; index < 20; index++) {
      element.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
    }
    const pending = (window as any).playgroundProbe.frames.size;
    (document.querySelector('[data-action="pause"]') as HTMLButtonElement).click();
    return { before, pending };
  });
  expect(result.pending).toBe(1);
  await expect(viewport).toHaveAttribute('data-render-pending', 'false');
  await expect(viewport).toHaveAttribute('data-render-count', result.before!);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-render-pending', 'false');
  await page.screenshot({ path: '../.codex/validation/v02-desktop.png', fullPage: true });
  const beforeResize = Number(await viewport.getAttribute('data-render-count'));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Number(await viewport.getAttribute('data-render-count'))).toBeGreaterThan(beforeResize);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await viewport.click({ position: { x: (await viewport.boundingBox())!.width / 2, y: 130 } });
  await expect(viewport).toHaveAttribute('data-selected', 'Create');
  await page.screenshot({ path: '../.codex/validation/v02-mobile.png', fullPage: true });
  await viewport.evaluate(element => {
    element.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    (document.querySelector('[data-action="unmount"]') as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  await expect.poll(() => resourceState(page)).toEqual({ plays: 0, activeAudio: 0, retainedAudio: 0, frames: 0, observers: 0 });
});

for (const action of ['Pause', 'Disable sound', 'Unmount']) {
  test(`invalidates pending playback on ${action.toLowerCase()}`, async ({ page }) => {
    await observeResources(page);
    await page.goto(standalone);
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
    await page.evaluate(() => { (window as any).playgroundProbe.holdPlayback = true; });
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await expect.poll(async () => (await resourceState(page)).plays).toBe(1);
    await page.getByRole('button', { name: action, exact: true }).click();
    if (action === 'Unmount') await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposing');
    if (action === 'Pause') await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.evaluate(() => (window as any).playgroundProbe.releasePlayback());
    await expect.poll(() => page.evaluate(() => (window as any).playgroundProbe.pendingPlays)).toBe(0);
    await expect.poll(async () => (await resourceState(page)).activeAudio).toBe(0);
    expect(await page.evaluate(() => (window as any).playgroundProbe.audio.every((audio: HTMLAudioElement) => audio.muted))).toBe(true);
    if (action !== 'Unmount') {
      await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
      await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    }
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    await expect.poll(() => resourceState(page)).toEqual({ plays: 1, activeAudio: 0, retainedAudio: 0, frames: 0, observers: 0 });
  });
}

test('blocked storage uses borrowed session preferences', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.goto(standalone);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(page.getByText('Session only', { exact: true })).toBeVisible();
  await page.locator('[data-card="Connect"]').click();
  await page.getByRole('slider', { name: 'Volume' }).fill('0.8');
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.locator('[data-card="Connect"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('0.8');
});

test('malformed preferences and unavailable media stay local', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('urk:v02:preferences', '{broken'));
  await page.route('**/audio/confirm.wav', route => route.fulfill({ status: 404, body: 'Missing audio' }));
  await page.goto(standalone);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(page.locator('[data-card="Explore"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('0.35');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.locator('[data-sound-status]')).toContainText('Sound unavailable');
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await page.evaluate(() => localStorage.setItem('urk:v02:preferences', JSON.stringify({ selected: 'unknown', volume: 9 })));
  // Clear the initialization script on a second page while keeping the same browser storage.
  const fresh = await page.context().newPage();
  await fresh.goto(standalone);
  await expect(fresh.locator('[data-card="Explore"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(fresh.getByRole('slider', { name: 'Volume' })).toHaveValue('0.35');
});

test('WebGL failure rolls back and a fresh kernel recovers', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (kind: string, ...args: unknown[]) {
      if (!(window as any).allowWebGL && kind.startsWith('webgl')) return null;
      return getContext.apply(this, [kind, ...args] as any);
    };
  });
  await page.goto(standalone);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  await expect(page.getByTestId('v02-owned')).toHaveText('0');
  await expect(page.getByTestId('v02-message')).toContainText('WebGL');
  await page.evaluate(() => { (window as any).allowWebGL = true; });
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(page.locator('canvas')).toBeVisible();
});


test('pause invalidates sound that is still loading', async ({ page }) => {
  await observeResources(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/audio/confirm.wav', async route => { await gate; await route.continue(); });
  await page.goto(standalone, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect(page.locator('output[data-sound-status]')).toContainText('Loading sound');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  release();
  await expect.poll(() => page.evaluate(() => (window as any).playgroundProbe.audio[0].readyState)).toBeGreaterThanOrEqual(3);
  expect((await resourceState(page)).plays).toBe(0);
  await page.locator('[data-card="Create"]').click();
  await expect.poll(async () => (await resourceState(page)).plays).toBe(1);
});

test('controller event subscriptions are released by shutdown', async ({ page }) => {
  await page.goto(standalone);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await page.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  const moduleUrl = `/@fs${fileURLToPath(new URL('../../../packages/examples/dist/v02/runtime.js', import.meta.url))}`;
  const counts = await page.evaluate(async url => {
    const { createV02Experience } = await import(url);
    const host = document.createElement('div');
    document.body.append(host);
    const kernel = createV02Experience(() => host);
    const events = kernel.getContext().events;
    const on = events.on.bind(events);
    let subscriptions = 0;
    events.on = (type: string, listener: (event: unknown) => void) => {
      subscriptions++;
      const unsubscribe = on(type, listener);
      let active = true;
      return () => {
        if (active) { active = false; subscriptions--; }
        unsubscribe();
      };
    };
    try {
      await kernel.boot();
      const running = subscriptions;
      await kernel.shutdown();
      return { running, disposed: subscriptions, surfaces: host.children.length };
    } finally { await kernel.shutdown(); host.remove(); }
  }, moduleUrl);
  expect(counts).toEqual({ running: 7, disposed: 0, surfaces: 0 });
});
