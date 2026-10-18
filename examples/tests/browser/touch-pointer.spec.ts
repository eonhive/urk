/**
 * Company: EonHive Inc.
 * Title: Touch Selection and Pointer Cleanup
 * Purpose: Verify tap-only feedback, native scrolling, and scoped interaction cleanup across hosts.
 * Author: Stan Nesi
 * Created: 2026-10-13
 * Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

const scene = (page: Page) => page.getByRole('group', { name: 'Interactive objects' });

async function center(page: Page): Promise<{ x: number; y: number }> {
  await scene(page).scrollIntoViewIfNeeded();
  const bounds = (await scene(page).boundingBox())!;
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function pointer(page: Page, type: string, pointerType: string): Promise<void> {
  const { x, y } = await center(page);
  await scene(page).dispatchEvent(type, { clientX: x, clientY: y, pointerType, pointerId: 2, isPrimary: true });
}

async function expectFeedback(page: Page, choice: string, cursor = 'default'): Promise<void> {
  await expect(page.getByRole('note', { name: choice, exact: true })).toBeVisible();
  await expect(scene(page)).toHaveCSS('cursor', cursor);
}

async function pointerListeners(page: Page): Promise<number> {
  return page.evaluate(() => {
    const targets: Map<EventTarget, Map<string, Set<unknown>>> = (window as any).renderingProbe.pointerListeners;
    let count = 0;
    for (const types of targets.values()) for (const listeners of types.values()) count += listeners.size;
    return count;
  });
}

async function expectReleased(page: Page): Promise<void> {
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  await expect(page.locator('canvas, [data-urk-overlay]')).toHaveCount(0);
  expect(await pointerListeners(page)).toBe(0);
  expect(await page.evaluate(() => ({ frames: (window as any).renderingProbe.frames.size,
    observers: (window as any).renderingProbe.observers.size }))).toEqual({ frames: 0, observers: 0 });
}

for (const [host, url] of [
  ['standalone', 'http://127.0.0.1:5174/v02/'],
  ['React', 'http://127.0.0.1:5174/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: tap-only feedback preserves mouse, pen, keyboard, and lifecycle behavior`, async ({ page, browserName }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    const viewport = scene(page);
    const listenerCount = await pointerListeners(page);
    expect(listenerCount).toBe(13); // Three target bindings, one surface binding, and the touch-down listener.
    await expect(viewport).toHaveCSS('touch-action', 'pan-y');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);

    const point = await center(page);
    await page.mouse.move(point.x, point.y);
    await expectFeedback(page, 'Create', 'pointer');
    await expect(viewport).toHaveAttribute('data-selected', 'Explore');
    await page.mouse.move(0, 0);
    await expectFeedback(page, 'Explore');
    // Pen and pre-scroll touch motion use controlled PointerEvents in every engine.
    await pointer(page, 'pointermove', 'pen');
    await expectFeedback(page, 'Create', 'pointer');
    await pointer(page, 'pointerdown', 'touch');
    await expectFeedback(page, 'Explore');
    await pointer(page, 'pointermove', 'touch');
    await expectFeedback(page, 'Explore');
    await expect(viewport).toHaveAttribute('data-selected', 'Explore');
    await pointer(page, 'pointerup', 'touch');
    await expect(viewport).toHaveAttribute('data-selected', 'Explore');
    const tap = await center(page);
    await page.touchscreen.tap(tap.x, tap.y);
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    await expectFeedback(page, 'Create');
    await viewport.tap({ position: { x: 8, y: 8 } });
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    await page.locator('[data-card="Explore"]').press('Space');
    await expect(viewport).toHaveAttribute('data-selected', 'Explore');
    await viewport.press('3');
    await expect(viewport).toHaveAttribute('data-selected', 'Connect');
    const rotation = page.getByRole('slider', { name: 'Selected object rotation' });
    await rotation.fill('45');
    await rotation.press('ArrowRight');
    await expect(rotation).toHaveValue('46');
    const savedRotation = await viewport.getAttribute('data-rotation');

    await pointer(page, 'pointermove', 'pen');
    await expectFeedback(page, 'Create', 'pointer');
    // Pause without moving the pointer first, to expose a stale inline cursor.
    await page.locator('[data-action="pause"]').evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('paused');
    await expect(viewport).toHaveCSS('cursor', 'default');
    await expect(page.locator('[data-overlay-status]')).toHaveText('Paused');
    await expect(page.locator('[data-overlay-callout]')).toBeHidden();
    const pausedTap = await center(page);
    await page.touchscreen.tap(pausedTap.x, pausedTap.y);
    await expect(viewport).toHaveAttribute('data-selected', 'Connect');
    await expect(viewport).toHaveAttribute('data-rotation', savedRotation!);
    await page.getByRole('button', { name: 'Resume', exact: true }).tap();

    await pointer(page, 'pointermove', 'pen');
    await expectFeedback(page, 'Create', 'pointer');
    await page.evaluate(() => {
      const extension = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is required.');
      Object.assign(window, { touchContext: extension });
      extension.loseContext();
    });
    await expect(viewport).toHaveAttribute('data-context-state', 'lost');
    await expect(viewport).toHaveCSS('cursor', 'default');
    await expect(page.locator('[data-overlay-status]')).toHaveText('Graphics unavailable. Waiting for recovery.');
    const lostTap = await center(page);
    await page.touchscreen.tap(lostTap.x, lostTap.y);
    await expect(viewport).toHaveAttribute('data-selected', 'Connect');
    await expect(viewport).toHaveAttribute('data-rotation', savedRotation!);
    await expect(page.locator('[data-overlay-callout]')).toBeHidden();
    await page.evaluate(() => (window as any).touchContext.restoreContext());
    await expect(viewport).toHaveAttribute('data-context-state', 'ready');
    await expectFeedback(page, 'Connect');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (host === 'standalone' && browserName === 'chromium') {
      await page.screenshot({ path: info.outputPath('touch-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(viewport).toHaveAttribute('data-render-pending', 'false');
      await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
      await page.screenshot({ path: info.outputPath('touch-desktop.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Unmount', exact: true }).tap();
    await expectReleased(page);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).tap();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    expect(await pointerListeners(page)).toBe(listenerCount);
    await page.getByRole('button', { name: 'Unmount', exact: true }).tap();
    await expectReleased(page);
    expect(errors).toEqual([]);
  });

  test(`${host}: native touch scroll cancels selection and unmount during contact releases listeners`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native touch sequences require Chromium CDP.');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    const viewport = scene(page);
    const listenerCount = await pointerListeners(page);
    const rotation = await viewport.getAttribute('data-rotation');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
    await page.evaluate(() => {
      const element = document.querySelector('.viewport')!;
      const events: { type: string; trusted: boolean }[] = [];
      Object.assign(window, { touchEvents: events, retainedViewport: element });
      for (const type of ['pointercancel', 'lostpointercapture', 'pointerleave', 'click']) {
        document.addEventListener(type, event => {
          if (event.target === element) events.push({ type, trusted: event.isTrusted });
        }, true);
      }
    });
    const point = await center(page);
    const scroll = await page.evaluate(() => scrollY);
    await touch('touchStart', point);
    await touch('touchMove', { x: point.x, y: point.y - 10 });
    await expectFeedback(page, 'Explore');
    await touch('touchMove', { x: point.x, y: point.y - 100 });
    await touch('touchEnd');
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll);
    const events = await page.evaluate(() => (window as any).touchEvents as { type: string; trusted: boolean }[]);
    expect(events.map(event => event.type)).toEqual(['pointercancel', 'lostpointercapture', 'pointerleave']);
    expect(events.every(event => event.trusted)).toBe(true);
    await expect(viewport).toHaveAttribute('data-selected', 'Explore');
    await expect(viewport).toHaveAttribute('data-rotation', rotation!);
    await expectFeedback(page, 'Explore');

    await touch('touchStart', await center(page));
    await page.locator('[data-action="unmount"]').evaluate((button: HTMLButtonElement) => button.click());
    await expectReleased(page);
    await touch('touchEnd');
    await page.evaluate(() => {
      const element = (window as any).retainedViewport as HTMLElement;
      for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerleave', 'click']) {
        element.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', bubbles: true }));
      }
    });
    await expectReleased(page);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).tap();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    expect(await pointerListeners(page)).toBe(listenerCount);
    await expect(scene(page)).toHaveAttribute('data-selected', 'Explore');
    const fresh = await center(page);
    await page.touchscreen.tap(fresh.x, fresh.y);
    await expect(scene(page)).toHaveAttribute('data-selected', 'Create');
    await page.getByRole('button', { name: 'Unmount', exact: true }).tap();
    await expectReleased(page);
    expect(errors).toEqual([]);
  });
}

test('click selection fires once and late contact is inert during pending cleanup', async ({ page }) => {
  await observeScene(page);
  await page.goto('http://127.0.0.1:5174/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createV02Experience } = await import(`/@fs${root}packages/examples/dist/v02/runtime.js`);
    const { UiOverlayCapability } = await import(`/@fs${root}packages/adapters/dist/ui-overlay/index.js`);
    const host = document.createElement('div');
    document.body.append(host);
    const kernel = createV02Experience(() => host, { preferences: { selected: 'Explore' } });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    try {
      await kernel.boot();
      await kernel.registerController({ id: 'pending-cleanup', dispose: () => pending });
      const ctx = kernel.getContext();
      let selections = 0;
      ctx.events.on('demo:selected', () => selections++);
      const card = host.querySelector<HTMLButtonElement>('[data-card="Create"]')!;
      for (const type of ['pointerdown', 'pointerup']) card.dispatchEvent(new PointerEvent(type, { pointerType: 'touch' }));
      const beforeClick = selections;
      card.click();
      const afterClick = selections;
      const viewport = host.querySelector<HTMLElement>('.viewport')!;
      const overlay = ctx.require(UiOverlayCapability);
      let feedback = 0;
      const show = overlay.showCallout;
      overlay.showCallout = (...args: unknown[]) => { feedback++; return show(...args); };
      const shutdown = kernel.shutdown();
      viewport.style.cursor = 'crosshair';
      const beforeLateEvents = feedback;
      for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerleave']) {
        viewport.dispatchEvent(new PointerEvent(type, { pointerType: 'touch' }));
      }
      card.click();
      const late = { selections, feedback: feedback - beforeLateEvents, cursor: viewport.style.cursor,
        lifecycle: kernel.getLifecycleSnapshot().state };
      release();
      await shutdown;
      return { beforeClick, afterClick, late, surfaces: host.children.length, borrowed: host.isConnected };
    } finally {
      release();
      await kernel.shutdown();
      host.remove();
    }
  }, root);
  expect(result).toEqual({ beforeClick: 0, afterClick: 1,
    late: { selections: 1, feedback: 0, cursor: 'crosshair', lifecycle: 'disposing' }, surfaces: 0, borrowed: true });
  expect(await pointerListeners(page)).toBe(0);
});
