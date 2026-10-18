/**
 * Company: EonHive Inc.
 * Title: Three Pixel Ratio Integration
 * Purpose: Verify fixed-size resolution changes, frozen redraws, recovery, and scoped cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-13
 * Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

async function activeResolutionQueries(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const listeners: Map<MediaQueryList, Set<unknown>> = (window as any).renderingProbe.resolutionListeners;
    return [...listeners].filter(([, entries]) => entries.size > 0).map(([query]) => query.media);
  });
}

for (const [host, url] of [
  ['standalone', 'http://127.0.0.1:5174/v02/'],
  ['React', 'http://127.0.0.1:5174/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: emulated DPR changes redraw a paused fixed-size scene once`, async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'Live device-scale emulation requires Chromium CDP.');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const session = await page.context().newCDPSession(page);
    let contrast = false;
    const setRatio = async (deviceScaleFactor: number, width = 1440, height = 1000) => {
      await session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
      // CDP changes DPR without invalidating media queries. An unused feature triggers native reevaluation.
      contrast = !contrast;
      await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-contrast', value: contrast ? 'more' : 'no-preference' }] });
    };
    await setRatio(3);
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    const canvas = page.locator('canvas');
    await page.locator('[data-card="Create"]').click();
    await page.getByRole('slider', { name: 'Selected object rotation' }).fill('90');
    await page.getByRole('combobox', { name: 'Scene layout' }).selectOption('arc');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    const frozen = await viewport.getAttribute('data-transition-progress');
    const cssSize = await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    let renders = Number(await viewport.getAttribute('data-render-count'));
    await expect.poll(() => activeResolutionQueries(page)).toEqual(['(resolution: 3dppx)']);

    // Both ratios hit the existing 2x cap: rearm without clearing or redrawing.
    await setRatio(4);
    await expect.poll(() => activeResolutionQueries(page)).toEqual(['(resolution: 4dppx)']);
    await expect(viewport).toHaveAttribute('data-render-count', String(renders));
    for (const ratio of [1.25, 1.5, 1]) {
      await setRatio(ratio);
      await expect.poll(() => activeResolutionQueries(page)).toEqual([`(resolution: ${ratio}dppx)`]);
      await expect(viewport).toHaveAttribute('data-render-count', String(++renders));
      expect(await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }))).toEqual(cssSize);
      await expect(canvas).toHaveAttribute('width', String(Math.floor(cssSize.width * ratio)));
      await expect(canvas).toHaveAttribute('height', String(Math.floor(cssSize.height * ratio)));
      await expect(viewport).toHaveAttribute('data-transition-progress', frozen!);
      await expect(viewport).toHaveAttribute('data-selected', 'Create');
      await expect(viewport).toHaveAttribute('data-rotation', '0.20,1.57');
      await expect(page.getByTestId('v02-lifecycle')).toHaveText('paused');
      await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    }
    await page.waitForTimeout(150);
    await expect(viewport).toHaveAttribute('data-render-count', String(renders));
    if (host === 'standalone') {
      await page.screenshot({ path: info.outputPath('pixel-ratio-desktop.png'), fullPage: true });
      // Keep Playwright's screenshot viewport aligned with CDP's metrics.
      await page.setViewportSize({ width: 390, height: 844 });
      await setRatio(2, 390, 844);
      await expect.poll(() => activeResolutionQueries(page)).toEqual(['(resolution: 2dppx)']);
      await expect(viewport).toHaveAttribute('data-render-pending', 'false');
      await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath('pixel-ratio-mobile.png'), fullPage: true, scale: 'css' });
    }
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await expect(viewport).toHaveAttribute('data-transition-progress', '1.000');
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    expect(await activeResolutionQueries(page)).toEqual([]);
    expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    expect(await activeResolutionQueries(page)).toHaveLength(1);
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    expect(await activeResolutionQueries(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('resolution rearming, context recovery, and pending shutdown preserve the Three contract', async ({ page }) => {
  await observeScene(page);
  await page.goto('http://127.0.0.1:5174/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createKernel } = await import(`/@fs${root}packages/core/dist/index.js`);
    const { createThreeAdapter, ThreeCapability } = await import(`/@fs${root}packages/adapters/dist/three/index.js`);
    const host = document.createElement('div');
    host.style.cssText = 'width:401px;height:301px';
    document.body.append(host);
    let ratio = 3;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => ratio });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const kernel = createKernel({ frameMode: 'auto', services: { 'three:host': host },
      adapters: [createThreeAdapter('density')], controllers: [{ id: 'pending', dispose: () => pending }],
    });
    const listeners: Map<MediaQueryList, Set<EventListenerOrEventListenerObject>> = (window as any).renderingProbe.resolutionListeners;
    const activeQueries = () => [...listeners].filter(([, entries]) => entries.size > 0).map(([query]) => query);
    // Other engines cannot change display scale live; deliver controlled native MQL events.
    const changeRatio = (value: number) => {
      const queries = activeQueries();
      ratio = value;
      for (const query of queries) query.dispatchEvent(new Event('change'));
    };
    try {
      await kernel.boot();
      const ctx = kernel.getContext();
      const api = ctx.require(ThreeCapability);
      const canvas = api.getCanvas();
      const renderer = api.getRenderer();
      const camera = api.getCamera();
      const ratios: number[] = [];
      let validPayloads = true;
      ctx.events.on('three:resize', (event: any) => {
        ratios.push(event.payload.pixelRatio);
        validPayloads &&= event.source === 'density' && event.payload.host === host && event.payload.width === 401 && event.payload.height === 301;
      });
      const queries: string[][] = [activeQueries().map(query => query.media)];
      changeRatio(4);
      queries.push(activeQueries().map(query => query.media));
      const capped = { ratio: renderer.getPixelRatio(), events: ratios.length };
      changeRatio(1.25);
      queries.push(activeQueries().map(query => query.media));
      const fractional = { width: canvas.width, height: canvas.height, aspect: camera.aspect };
      changeRatio(1.5);
      queries.push(activeQueries().map(query => query.media));
      const extension = renderer.getContext().getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is required.');
      const nativeEvent = (type: string) => new Promise<void>(resolve => canvas.addEventListener(type, () => setTimeout(resolve, 0), { once: true }));
      const lost = nativeEvent('webglcontextlost');
      extension.loseContext();
      await lost;
      changeRatio(1);
      queries.push(activeQueries().map(query => query.media));
      const whileLost = { ratio: renderer.getPixelRatio(), events: ratios.length };
      const restored = nativeEvent('webglcontextrestored');
      extension.restoreContext();
      await restored;
      const recovered = { ratio: renderer.getPixelRatio(), width: canvas.width, height: canvas.height };
      const queryCount = listeners.size;
      const shutdown = kernel.shutdown();
      changeRatio(2);
      const afterAbort = { queryCount: listeners.size, events: ratios.length, ratio: renderer.getPixelRatio() };
      release();
      await shutdown;
      // Retained native objects cannot rearm listeners after completed disposal.
      for (const query of listeners.keys()) query.dispatchEvent(new Event('change'));
      return { queries, capped, fractional, whileLost, recovered, ratios, validPayloads, queryCount, afterAbort,
        active: activeQueries().length, canvases: host.querySelectorAll('canvas').length, borrowed: host.isConnected };
    } finally {
      release();
      await kernel.shutdown();
      if (descriptor) Object.defineProperty(window, 'devicePixelRatio', descriptor);
      else Reflect.deleteProperty(window, 'devicePixelRatio');
      host.remove();
    }
  }, root);
  expect(result).toEqual({
    queries: [3, 4, 1.25, 1.5, 1].map(ratio => [`(resolution: ${ratio}dppx)`]),
    capped: { ratio: 2, events: 0 }, fractional: { width: 501, height: 376, aspect: 401 / 301 },
    whileLost: { ratio: 1.5, events: 2 }, recovered: { ratio: 1, width: 401, height: 301 },
    ratios: [1.25, 1.5, 1], validPayloads: true, queryCount: 5,
    afterAbort: { queryCount: 5, events: 3, ratio: 1 }, active: 0, canvases: 0, borrowed: true,
  });
});
