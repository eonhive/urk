/**
 * Company: EonHive Inc.
 * Title: Live Playground Motion Preferences
 * Purpose: Verify live reduced motion without resuming paused or unavailable scenes.
 * Author: Stan Nesi
 * Created: 2026-10-13
 * Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

async function openScene(page: Page, url: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await observeScene(page);
  await page.addInitScript(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const progress: number[] = [];
    Object.assign(window, { reducedMotionFrames: progress, motionPreference: reduced });
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => request(time => {
      const viewport = document.querySelector<HTMLElement>('.viewport');
      const renders = viewport?.dataset.renderCount;
      callback(time);
      if (reduced.matches && viewport && viewport.dataset.renderCount !== renders &&
          document.querySelector('[data-testid="v02-lifecycle"]')?.textContent === 'running') {
        progress.push(Number(viewport.dataset.transitionProgress));
      }
    });
  });
  await page.goto(url);
  await expect(page.getByTestId('v02-phase')).toHaveText('ready');
  await expect(page.getByRole('group', { name: 'Interactive objects' })).toHaveAttribute('data-render-pending', 'false');
}

async function setMotionPreference(page: Page, reducedMotion: 'reduce' | 'no-preference'): Promise<void> {
  await page.emulateMedia({ reducedMotion });
  // WebKit can acknowledge emulation before updating existing media-query objects.
  await expect.poll(() => page.evaluate(() => (window as any).motionPreference.matches)).toBe(reducedMotion === 'reduce');
}

async function expectReleased(page: Page): Promise<void> {
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  await expect(page.locator('canvas, [data-urk-overlay]')).toHaveCount(0);
  expect(await page.evaluate(() => {
    const probe = (window as any).renderingProbe;
    let listeners = 0;
    for (const targets of [probe.contextListeners, probe.pointerListeners]) {
      for (const types of targets.values()) for (const entries of types.values()) listeners += entries.size;
    }
    for (const entries of probe.resolutionListeners.values()) listeners += entries.size;
    return { frames: probe.frames.size, observers: probe.observers.size, listeners };
  })).toEqual({ frames: 0, observers: 0, listeners: 0 });
}

for (const [host, url] of [
  ['standalone', 'http://127.0.0.1:5174/v02/'],
  ['React', 'http://127.0.0.1:5174/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: live reduced motion finishes active work and stays idle`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openScene(page, url);
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    const layout = page.getByRole('combobox', { name: 'Scene layout' });
    await page.locator('[data-card="Create"]').press('Enter');
    await page.getByRole('slider', { name: 'Selected object rotation' }).fill('75');
    await layout.selectOption('arc');
    await expect.poll(async () => Number(await viewport.getAttribute('data-transition-progress'))).toBeGreaterThan(0);
    expect(Number(await viewport.getAttribute('data-transition-progress'))).toBeLessThan(1);
    await setMotionPreference(page, 'reduce');
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await expect(viewport).toHaveAttribute('data-transition-progress', '1.000');
    const frames = await page.evaluate(() => (window as any).reducedMotionFrames as number[]);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(progress => progress === 1)).toBe(true);
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    await expect(viewport).toHaveAttribute('data-rotation', '0.20,1.31');
    await expect(page.locator('[data-overlay-status]')).toHaveText('Selected: Create');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('reduced-motion-desktop.png'), fullPage: true });

    const idleRenders = await viewport.getAttribute('data-render-count');
    for (const reducedMotion of ['no-preference', 'reduce', 'no-preference'] as const) {
      await setMotionPreference(page, reducedMotion);
      await page.waitForTimeout(100);
      await expect(viewport).toHaveAttribute('data-render-count', idleRenders!);
      expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
    }
    await layout.selectOption('row');
    await expect(page.getByTestId('v02-phase')).toHaveText('transition');
    await expect.poll(async () => Number(await viewport.getAttribute('data-transition-progress'))).toBeGreaterThan(0);
    expect(Number(await viewport.getAttribute('data-transition-progress'))).toBeLessThan(1);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await setMotionPreference(page, 'reduce');
    await layout.selectOption('arc');
    await expect(viewport).toHaveAttribute('data-transition-progress', '1');
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('reduced-motion-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expectReleased(page);
  });

  test(`${host}: live motion preferences respect paused and lost graphics`, async ({ page }) => {
    await openScene(page, url);
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    const phase = page.getByTestId('v02-phase');
    const layout = page.getByRole('combobox', { name: 'Scene layout' });
    // Cover paused, unavailable, and paused restoration using real context events.
    for (const mode of ['paused', 'lost', 'paused-lost']) {
      await setMotionPreference(page, 'no-preference');
      // Interrupt in the browser so runner delays cannot outlast the finite transition.
      await layout.evaluate((element, mode) => {
        const select = element as HTMLSelectElement;
        select.value = mode === 'lost' ? 'row' : 'arc';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const viewport = document.querySelector<HTMLElement>('.viewport')!;
        const extension = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WEBGL_lose_context is required.');
        Object.assign(window, { motionContext: extension });
        return new Promise<void>(resolve => {
          const interrupt = (): void => {
            if (viewport.dataset.layout !== select.value || Number(viewport.dataset.transitionProgress) >= 1) {
              requestAnimationFrame(interrupt);
              return;
            }
            if (mode !== 'lost') document.querySelector<HTMLButtonElement>('[data-action="pause"]')!.click();
            if (mode !== 'paused') extension.loseContext();
            resolve();
          };
          requestAnimationFrame(interrupt);
        });
      }, mode);
      if (mode !== 'paused') {
        await expect(viewport).toHaveAttribute('data-context-state', 'lost');
      }
      const frozen = await viewport.getAttribute('data-transition-progress');
      const renders = Number(await viewport.getAttribute('data-render-count'));
      expect(Number(frozen)).toBeLessThan(1);
      await setMotionPreference(page, 'reduce');
      await page.waitForTimeout(700);
      await expect(viewport).toHaveAttribute('data-transition-progress', frozen!);
      await expect(viewport).toHaveAttribute('data-render-count', String(renders));
      await expect(phase).toHaveText(mode === 'lost' ? 'transition' : 'paused');
      expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
      if (mode !== 'paused') {
        await page.evaluate(() => { (window as any).motionContext.restoreContext(); });
        await expect(viewport).toHaveAttribute('data-context-state', 'ready');
        await expect.poll(async () => Number(await viewport.getAttribute('data-render-count'))).toBe(renders + 1);
        if (mode === 'paused-lost') {
          await expect(phase).toHaveText('paused');
          await expect(viewport).toHaveAttribute('data-transition-progress', frozen!);
        }
      }
      if (mode !== 'lost') await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await expect(phase).toHaveText('ready');
      await expect(viewport).toHaveAttribute('data-transition-progress', '1.000');
      await expect(viewport).toHaveAttribute('data-render-count', String(renders + (mode === 'paused-lost' ? 2 : 1)));
      await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
      expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
    }
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expectReleased(page);
  });

  test(`${host}: preference changes after unmount stay silent and fresh mounts work`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openScene(page, url);
    await page.getByRole('combobox', { name: 'Scene layout' }).selectOption('arc');
    await expect(page.getByTestId('v02-phase')).toHaveText('transition');
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expectReleased(page);
    await setMotionPreference(page, 'reduce');
    await page.waitForTimeout(100);
    await expectReleased(page);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await page.getByRole('combobox', { name: 'Scene layout' }).selectOption('arc');
    await expect(page.getByRole('group', { name: 'Interactive objects' })).toHaveAttribute('data-transition-progress', '1');
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expectReleased(page);
    expect(errors).toEqual([]);
  });
}

test('queued reduced-motion layouts wait for eligibility and cannot settle after abort', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observeScene(page);
  await page.goto('http://127.0.0.1:5174/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createKernel } = await import(`/@fs${root}packages/core/dist/index.js`);
    const { createThreeAdapter, ThreeCapability } = await import(`/@fs${root}packages/adapters/dist/three/index.js`);
    const { createPlaygroundScene } = await import(`/@fs${root}packages/examples/dist/v02/scene.js`);
    const host = document.createElement('div');
    host.style.cssText = 'width:400px;height:300px';
    document.body.append(host);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const kernel = createKernel({ frameMode: 'auto', services: { 'three:host': host },
      adapters: [createThreeAdapter()], controllers: [{ id: 'pending', dispose: () => pending }],
    });
    try {
      await kernel.boot();
      let settlements = 0;
      const scene = createPlaygroundScene(kernel.getContext(), () => { settlements++; }, () => {});
      const three = kernel.getContext().require(ThreeCapability);
      const canvas = three.getCanvas();
      const extension = three.getRenderer().getContext().getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context is required.');
      const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const nativeEvent = (type: string) => new Promise<void>(resolve => canvas.addEventListener(type, () => setTimeout(resolve, 0), { once: true }));
      scene.setPaused(true);
      scene.setLayout('arc');
      await nextFrame();
      const whilePaused = settlements;
      scene.setPaused(false);
      await nextFrame();
      const afterResume = settlements;
      const lost = nativeEvent('webglcontextlost');
      extension.loseContext();
      await lost;
      scene.setLayout('row');
      await nextFrame();
      const whileLost = settlements;
      const restored = nativeEvent('webglcontextrestored');
      extension.restoreContext();
      await restored;
      await nextFrame();
      const afterRestore = settlements;
      scene.setPaused(true);
      scene.setLayout('arc');
      scene.setPaused(false);
      const shutdown = kernel.shutdown();
      scene.setLayout('row');
      await nextFrame();
      const afterAbort = settlements;
      release();
      await shutdown;
      return { whilePaused, afterResume, whileLost, afterRestore, afterAbort, canvases: host.querySelectorAll('canvas').length };
    } finally {
      release();
      await kernel.shutdown();
      host.remove();
    }
  }, root);
  expect(result).toEqual({ whilePaused: 0, afterResume: 1, whileLost: 1, afterRestore: 2, afterAbort: 2, canvases: 0 });
  expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
});
