/**
 * Company: EonHive Inc.
 * Title: Interactive Rendering and UI Integration
 * Purpose: Verify native controls, finite transitions, responsive drawing, and adapter cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-12
 * Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

for (const [host, url] of [
  ['standalone', 'http://127.0.0.1:5174/v02/'],
  ['React', 'http://127.0.0.1:5174/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: native controls, overlay, paused transition resize, and disposal`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    const phase = page.getByTestId('v02-phase');
    const rotation = page.getByRole('slider', { name: 'Selected object rotation' });
    const layout = page.getByRole('combobox', { name: 'Scene layout' });
    await expect(phase).toHaveText('ready');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    await page.locator('[data-card="Create"]').press('Enter');
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    await expect(page.locator('[data-overlay-status]')).toHaveText('Selected: Create');
    await expect(page.getByRole('note', { name: 'Create' })).toBeVisible();
    await rotation.fill('90');
    await expect(viewport).toHaveAttribute('data-rotation', '0.20,1.57');
    await rotation.press('ArrowRight');
    await expect(rotation).toHaveValue('91');
    await expect(viewport).toHaveAttribute('data-rotation', '0.20,1.59');
    await page.locator('[data-card="Explore"]').press('Space');
    await expect(viewport).toHaveAttribute('data-selected', 'Explore');
    await expect(rotation).toHaveValue('20');
    await viewport.hover();
    await expect(page.getByRole('note', { name: 'Create' })).toBeVisible();
    await expect(page.locator('[data-overlay-status]')).toHaveText('Selected: Explore');
    await page.locator('[data-card="Create"]').click();
    await expect(rotation).toHaveValue('91');
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('scene-desktop.png'), fullPage: true });

    await layout.selectOption('arc');
    await expect(phase).toHaveText('transition');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('paused');
    await expect(layout).toBeDisabled();
    await expect(rotation).toBeDisabled();
    await expect(page.locator('[data-overlay-status]')).toHaveText('Paused');
    const frozen = await viewport.getAttribute('data-transition-progress');
    const renders = Number(await viewport.getAttribute('data-render-count'));
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => Number(await viewport.getAttribute('data-render-count'))).toBeGreaterThan(renders);
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    await page.waitForTimeout(750);
    await expect(viewport).toHaveAttribute('data-transition-progress', frozen!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(phase).toHaveText('ready');
    await expect(viewport).toHaveAttribute('data-transition-progress', '1.000');
    await expect(viewport).toHaveAttribute('data-layout', 'arc');
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    const sceneBounds = await viewport.boundingBox();
    const calloutBounds = await page.locator('[data-overlay-callout]').boundingBox();
    expect(calloutBounds!.y).toBeGreaterThanOrEqual(sceneBounds!.y + sceneBounds!.height);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('scene-mobile.png'), fullPage: true });
    const idleRenders = await viewport.getAttribute('data-render-count');
    await page.waitForTimeout(150);
    await expect(viewport).toHaveAttribute('data-render-count', idleRenders!);

    await layout.evaluate(element => {
      for (const value of ['row', 'arc', 'row']) {
        (element as HTMLSelectElement).value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await expect(viewport).toHaveAttribute('data-layout', 'row');
    await expect(phase).toHaveText('ready');
    await layout.selectOption('arc');
    await expect(phase).toHaveText('transition');
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    await expect(page.locator('canvas, [data-urk-overlay]')).toHaveCount(0);
    expect(await page.evaluate(() => ({ frames: (window as any).renderingProbe.frames.size,
      observers: (window as any).renderingProbe.observers.size }))).toEqual({ frames: 0, observers: 0 });
    expect(errors).toEqual([]);
  });
}

test('reduced motion settles layouts immediately and returns to idle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observeScene(page);
  await page.goto('http://127.0.0.1:5174/v02/');
  await expect(page.getByTestId('v02-phase')).toHaveText('ready');
  await page.getByRole('combobox', { name: 'Scene layout' }).selectOption('arc');
  const viewport = page.getByRole('group', { name: 'Interactive objects' });
  await expect(viewport).toHaveAttribute('data-transition-progress', '1');
  await expect(page.getByTestId('v02-phase')).toHaveText('ready');
  await expect(viewport).toHaveAttribute('data-render-pending', 'false');
  expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
});

test('adapters pick before drawing, retain unchanged buffers, reset scoped input, and stop on abort', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/v02/');
  await expect(page.getByTestId('v02-phase')).toHaveText('ready');
  await page.getByRole('button', { name: 'Unmount', exact: true }).click();
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createKernel } = await import(`/@fs${root}packages/core/dist/index.js`);
    const { createThreeAdapter, ThreeCapability } = await import(`/@fs${root}packages/adapters/dist/three/index.js`);
    const { createInputAdapter, InputCapability } = await import(`/@fs${root}packages/adapters/dist/input/index.js`);
    const { createPointerAdapter, PointerCapability } = await import(`/@fs${root}packages/adapters/dist/pointer/index.js`);
    const THREE = await import(`/@fs${root}node_modules/three/build/three.module.js`);
    const host = document.createElement('div');
    host.style.cssText = 'width:600px;height:300px;position:fixed;top:0;left:0';
    host.tabIndex = 0;
    const outside = document.createElement('button');
    document.body.append(host, outside);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const kernel = createKernel({ frameMode: 'auto', services: { 'three:host': host, 'input:target': host },
      adapters: [createThreeAdapter(), createInputAdapter(), createPointerAdapter()],
      controllers: [{ id: 'pending-cleanup', dispose: () => pending }],
    });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 'red' });
    try {
      await kernel.boot();
      const ctx = kernel.getContext();
      const three = ctx.require(ThreeCapability);
      const input = ctx.require(InputCapability);
      ctx.require(PointerCapability).bindTarget({ id: 'host', element: host });
      let selections = 0;
      ctx.events.on('pointer:select', () => selections++);
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      three.getScene().add(group);
      group.position.x = 1;
      three.getCamera().position.x = 1;
      three.getCamera().lookAt(1, 0, 0);
      const hit = three.raycast(300, 150, [group])[0]?.object === mesh;
      group.position.x = 6;
      const moved = three.raycast(300, 150, [group]).length === 0;
      group.position.x = 1;
      three.render();
      const gl = three.getRenderer().getContext();
      const pixel = new Uint8Array(4);
      const alpha = () => { gl.readPixels(gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return pixel[3]; };
      const before = alpha();
      let resizes = 0;
      ctx.events.on('three:resize', () => resizes++);
      three.resize();
      three.resize();
      const after = alpha();
      host.style.width = '400px';
      three.resize();
      host.focus();
      host.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
      const pressed = input.isPressed('ArrowRight');
      outside.focus();
      const released = !input.isPressed('ArrowRight');
      host.focus();
      host.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
      const shutdown = kernel.shutdown();
      host.click();
      three.resize();
      let renderedAfterAbort = false;
      const render = three.getRenderer().render;
      three.getRenderer().render = () => { renderedAfterAbort = true; };
      three.render();
      three.getRenderer().render = render;
      const stopped = !input.isPressed('ArrowRight') && three.raycast(200, 150, [group]).length === 0;
      release();
      await shutdown;
      return { hit, moved, before, after, resizes, pressed, released, stopped, selections, renderedAfterAbort,
        canvasCount: host.querySelectorAll('canvas').length, borrowedHost: host.isConnected };
    } finally {
      release();
      await kernel.shutdown();
      geometry.dispose();
      material.dispose();
      host.remove();
      outside.remove();
    }
  }, root);
  expect(result).toEqual({ hit: true, moved: true, before: 255, after: 255, resizes: 1, pressed: true,
    released: true, stopped: true, selections: 0, renderedAfterAbort: false, canvasCount: 0, borrowedHost: true });
});
