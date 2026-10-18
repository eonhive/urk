/**
 * Company: EonHive Inc.
 * Title: WebGL Context Recovery Integration
 * Purpose: Verify native context loss, state-preserving restoration, and cancellation cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-13
 * Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

async function loseContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('The recovery test requires WEBGL_lose_context.');
    Object.assign(window, { contextFixture: { canvas, extension } });
    extension.loseContext();
  });
  await expect(page.getByRole('group', { name: 'Interactive objects' })).toHaveAttribute('data-context-state', 'lost');
  await expect(page.locator('canvas')).toHaveCSS('visibility', 'hidden');
}

async function restoreContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).renderingProbe.pixels = 0;
    (window as any).contextFixture.extension.restoreContext();
  });
  await expect(page.getByRole('group', { name: 'Interactive objects' })).toHaveAttribute('data-context-state', 'ready');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
}

async function expectReleased(page: Page): Promise<void> {
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  await expect(page.locator('canvas, [data-urk-overlay]')).toHaveCount(0);
  expect(await page.evaluate(() => {
    const probe = (window as any).renderingProbe;
    let listeners = 0;
    for (const types of probe.contextListeners.values()) {
      for (const entries of types.values()) listeners += entries.size;
    }
    return { frames: probe.frames.size, observers: probe.observers.size, listeners };
  })).toEqual({ frames: 0, observers: 0, listeners: 0 });
}

for (const [host, url] of [
  ['standalone', 'http://127.0.0.1:5174/v02/'],
  ['React', 'http://127.0.0.1:5174/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: restores selection, rotation, transitions, and a paused canvas`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    const lifecycle = page.getByTestId('v02-lifecycle');
    const phase = page.getByTestId('v02-phase');
    const layout = page.getByRole('combobox', { name: 'Scene layout' });
    const rotation = page.getByRole('slider', { name: 'Selected object rotation' });
    await expect(phase).toHaveText('ready');
    await page.locator('[data-card="Create"]').click();
    await rotation.fill('75');
    const originalRotation = await viewport.getAttribute('data-rotation');
    const originalKernel = await viewport.getAttribute('aria-describedby');
    await layout.selectOption('arc');
    await expect(phase).toHaveText('transition');
    await loseContext(page);
    await expect(lifecycle).toHaveText('running');
    await expect(page.locator('[data-overlay-status]')).toHaveText('Graphics unavailable. Waiting for recovery.');
    await expect(page.locator('[data-overlay-callout]')).toBeHidden();
    await expect(layout).toBeDisabled();
    await expect(rotation).toBeDisabled();
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    const frozen = await viewport.getAttribute('data-transition-progress');
    expect(Number(frozen)).toBeLessThan(1);
    const renders = await viewport.getAttribute('data-render-count');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(750);
    await expect(viewport).toHaveAttribute('data-transition-progress', frozen!);
    await expect(viewport).toHaveAttribute('data-render-count', renders!);
    await viewport.press('1');
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('context-lost-mobile.png'), fullPage: true });

    await restoreContext(page);
    await expect(phase).toHaveText('ready');
    await expect(viewport).toHaveAttribute('data-layout', 'arc');
    await expect(viewport).toHaveAttribute('data-transition-progress', '1.000');
    await expect(viewport).toHaveAttribute('data-rotation', originalRotation!);
    await expect(viewport).toHaveAttribute('aria-describedby', originalKernel!);
    await expect(rotation).toHaveValue('75');
    await expect(rotation).toBeEnabled();
    await expect(page.locator('[data-overlay-status]')).toHaveText('Selected: Create');
    expect(await page.evaluate(() => document.querySelector('canvas') === (window as any).contextFixture.canvas)).toBe(true);
    expect(await page.locator('canvas').evaluate(canvas => (canvas as HTMLCanvasElement).width === Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)))).toBe(true);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('context-restored-mobile.png'), fullPage: true });

    await layout.selectOption('row');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await loseContext(page);
    const pausedProgress = await viewport.getAttribute('data-transition-progress');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(lifecycle).toHaveText('running');
    await expect(layout).toBeDisabled();
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const pausedRenders = Number(await viewport.getAttribute('data-render-count'));
    await restoreContext(page);
    await expect(lifecycle).toHaveText('paused');
    await expect(phase).toHaveText('paused');
    await expect(rotation).toBeDisabled();
    await expect(page.locator('[data-overlay-status]')).toHaveText('Paused');
    await expect.poll(async () => Number(await viewport.getAttribute('data-render-count'))).toBe(pausedRenders + 1);
    await page.waitForTimeout(750);
    await expect(viewport).toHaveAttribute('data-transition-progress', pausedProgress!);
    await expect(viewport).toHaveAttribute('data-render-count', String(pausedRenders + 1));
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(phase).toHaveText('ready');
    await expect(viewport).toHaveAttribute('data-layout', 'row');
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expectReleased(page);
    expect(errors).toEqual([]);
  });

  test(`${host}: unmount during restoration releases listeners and cannot revive the scene`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await loseContext(page);
    await page.evaluate(() => {
      (window as any).contextFixture.extension.restoreContext();
      document.querySelector<HTMLButtonElement>('[data-action="unmount"]')!.click();
    });
    await expectReleased(page);
    // Late browser delivery to a retained canvas must not recreate subscriptions or frames.
    await page.evaluate(() => {
      const canvas = (window as any).contextFixture.canvas;
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    });
    await expectReleased(page);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expectReleased(page);
    expect(errors).toEqual([]);
  });
}

test('Three recovery events preserve identity and stay silent after abort during pending cleanup', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createKernel } = await import(`/@fs${root}packages/core/dist/index.js`);
    const { createThreeAdapter, ThreeCapability } = await import(`/@fs${root}packages/adapters/dist/three/index.js`);
    const host = document.createElement('div');
    host.style.cssText = 'width:400px;height:300px';
    document.body.append(host);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const kernel = createKernel({ frameMode: 'auto', services: { 'three:host': host },
      adapters: [createThreeAdapter('recovery')], controllers: [{ id: 'pending', dispose: () => pending }],
    });
    try {
      await kernel.boot();
      const ctx = kernel.getContext();
      const api = ctx.require(ThreeCapability);
      const canvas = api.getCanvas();
      const renderer = api.getRenderer();
      const scene = api.getScene();
      const extension = renderer.getContext().getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is required.');
      const events: string[] = [];
      let validPayloads = true;
      for (const type of ['three:context-lost', 'three:context-restored']) ctx.events.on(type, (event: any) => {
        events.push(type);
        validPayloads &&= event.source === 'recovery' && event.payload.host === host && event.payload.canvas === canvas;
      });
      // Restoration is permitted only after the browser finishes dispatching the loss event.
      const nativeEvent = (type: string) => new Promise<void>(resolve => canvas.addEventListener(type, () => setTimeout(resolve, 0), { once: true }));
      const lost = nativeEvent('webglcontextlost');
      extension.loseContext();
      await lost;
      let draws = 0;
      const render = renderer.render;
      renderer.render = () => { draws++; };
      api.render();
      renderer.render = render;
      host.style.width = '250px';
      api.resize();
      const lostSize = api.getSize().width;
      const restored = nativeEvent('webglcontextrestored');
      extension.restoreContext();
      await restored;
      const restoredSize = api.getSize().width;
      const identity = api.getRenderer() === renderer && api.getScene() === scene && api.getCanvas() === canvas;
      const lostAgain = nativeEvent('webglcontextlost');
      extension.loseContext();
      await lostAgain;
      const shutdown = kernel.shutdown();
      const pendingState = kernel.getLifecycleSnapshot().state;
      const lateRestore = nativeEvent('webglcontextrestored');
      extension.restoreContext();
      await lateRestore;
      release();
      await shutdown;
      return { events, validPayloads, identity, draws, lostSize, restoredSize, pendingState,
        canvasCount: host.querySelectorAll('canvas').length, borrowedHost: host.isConnected };
    } finally {
      release();
      await kernel.shutdown();
      host.remove();
    }
  }, root);
  expect(result).toEqual({ events: ['three:context-lost', 'three:context-restored', 'three:context-lost'],
    validPayloads: true, identity: true, draws: 0, lostSize: 400, restoredSize: 250, pendingState: 'disposing',
    canvasCount: 0, borrowedHost: true });
});
