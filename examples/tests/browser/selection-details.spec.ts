/**
 * Company: EonHive Inc.
 * Title: Selection Details Integration
 * Purpose: Verify native details, per-object materials, recovery, and scoped cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

test.use({ baseURL: `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}` });

async function detailsListeners(page: Page): Promise<number> {
  return page.evaluate(() => {
    const targets: Map<EventTarget, Map<string, Set<unknown>>> = (window as any).renderingProbe.detailsListeners;
    let count = 0;
    for (const types of targets.values()) for (const listeners of types.values()) count += listeners.size;
    return count;
  });
}

for (const [host, url] of [
  ['standalone', '/v02/'],
  ['React', '/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: selection details change real materials without taking over native focus`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    const details = page.locator('.selection-details');
    const summary = details.locator('summary');
    const checkbox = details.getByRole('checkbox', { name: 'Wireframe' });
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    await expect(details).not.toHaveAttribute('open');
    expect(await detailsListeners(page)).toBe(2);
    const create = page.locator('[data-card="Create"]');
    await create.press('Enter');
    await expect(details).toHaveAttribute('open');
    await expect(details.getByRole('heading', { name: 'Create', exact: true })).toBeVisible();
    await expect(create).toBeFocused();
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    const solidPixels = await page.evaluate(() => (window as any).renderingProbe.pixels);
    expect(solidPixels).toBeGreaterThan(500);
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(viewport).toHaveAttribute('data-wireframe', 'true');
    // A changed drawing buffer proves the action reaches Three, not just checkbox state.
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeLessThan(solidPixels);
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    await page.keyboard.press('Escape');
    await expect(details).not.toHaveAttribute('open');
    await expect(summary).toBeFocused();
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    await expect(viewport).toHaveAttribute('data-wireframe', 'true');
    await page.keyboard.press('Enter');
    await expect(checkbox).toBeChecked();
    await page.locator('[data-card="Explore"]').press('Space');
    await expect(checkbox).not.toBeChecked();
    await viewport.hover();
    await expect(page.getByRole('note', { name: 'Create' })).toBeVisible();
    await expect(details.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await viewport.press('2');
    await expect(checkbox).toBeChecked();
    await expect(viewport).toBeFocused();
    await viewport.press('Escape');
    await expect(details).toHaveAttribute('open');
    const rotation = page.getByRole('slider', { name: 'Selected object rotation' });
    await rotation.fill('75');
    await rotation.press('ArrowRight');
    await expect(rotation).toHaveValue('76');
    await page.getByRole('combobox', { name: 'Scene layout' }).selectOption('arc');
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await expect(viewport).toHaveAttribute('data-wireframe', 'true');
    await checkbox.focus();
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('details-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(checkbox).toBeFocused();
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = (await details.boundingBox())!;
    const canvas = (await viewport.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
    const control = (await checkbox.boundingBox())!;
    expect(control.x).toBeGreaterThanOrEqual(bounds.x);
    expect(control.x + control.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('details-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    await expect(details).toHaveCount(0);
    expect(await detailsListeners(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test(`${host}: details survive pause and graphics recovery, and reset on a fresh kernel`, async ({ page }) => {
    await observeScene(page);
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    const details = page.locator('.selection-details');
    const checkbox = details.getByRole('checkbox', { name: 'Wireframe' });
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    await page.locator('[data-card="Create"]').press('Enter');
    await checkbox.check();
    await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(checkbox).toBeDisabled();
    const renders = await viewport.getAttribute('data-render-count');
    await checkbox.evaluate((input: HTMLInputElement) => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(checkbox).toBeChecked();
    await expect(viewport).toHaveAttribute('data-render-count', renders!);
    await details.locator('summary').press('Enter');
    await expect(details).not.toHaveAttribute('open');
    await details.locator('summary').press('Space');
    await expect(details).toHaveAttribute('open');
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas')!;
      const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Native context loss is required.');
      Object.assign(window, { detailsContext: extension });
      extension.loseContext();
    });
    await expect(viewport).toHaveAttribute('data-context-state', 'lost');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(checkbox).toBeDisabled();
    await checkbox.evaluate((input: HTMLInputElement) => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(checkbox).toBeChecked();
    await expect(viewport).toHaveAttribute('data-wireframe', 'true');
    await page.evaluate(() => (window as any).detailsContext.restoreContext());
    await expect(viewport).toHaveAttribute('data-context-state', 'ready');
    await expect(checkbox).toBeEnabled();
    await expect(checkbox).toBeChecked();
    await expect(details).toHaveAttribute('open');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    await checkbox.uncheck();
    await expect(viewport).toHaveAttribute('data-wireframe', 'false');
    await checkbox.check();
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await expect(details).not.toHaveAttribute('open');
    await expect(viewport).toHaveAttribute('data-selected', 'Create');
    await expect(viewport).toHaveAttribute('data-wireframe', 'false');
    expect(await detailsListeners(page)).toBe(2);
    await page.getByRole('button', { name: 'Unmount', exact: true }).click();
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    expect(await detailsListeners(page)).toBe(0);
    expect(await page.evaluate(() => ({ frames: (window as any).renderingProbe.frames.size,
      observers: (window as any).renderingProbe.observers.size }))).toEqual({ frames: 0, observers: 0 });
  });
}

test('details are instance-local and late events cannot mutate materials during or after shutdown', async ({ page }) => {
  await observeScene(page);
  await page.goto('/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createV02Experience } = await import(`/@fs${root}packages/examples/dist/v02/runtime.js`);
    const { ThreeCapability } = await import(`/@fs${root}packages/adapters/dist/three/index.js`);
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const a = createV02Experience(() => first, { preferences: { selected: 'Create' } });
    const b = createV02Experience(() => second, { preferences: { selected: 'Explore' } });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    try {
      await a.boot();
      await b.boot();
      await a.registerController({ id: 'hold-cleanup', dispose: () => pending });
      const material = a.getContext().require(ThreeCapability).getScene().getObjectByName('Create').material;
      const checkbox = first.querySelector<HTMLInputElement>('input[data-wireframe]')!;
      const details = first.querySelector<HTMLDetailsElement>('details')!;
      details.open = true;
      checkbox.click();
      const independent = !second.querySelector<HTMLInputElement>('input[data-wireframe]')!.checked &&
        first.querySelector('[data-details-title]')!.id !== second.querySelector('[data-details-title]')!.id;
      const actualMaterial = material.wireframe;
      const shutdown = a.shutdown();
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      details.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const pendingInert = material.wireframe && details.open && a.getLifecycleSnapshot().state === 'disposing';
      release();
      await shutdown;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      details.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { actualMaterial, independent, pendingInert, lateInert: material.wireframe && details.open,
        borrowed: first.isConnected && first.children.length === 0,
        secondLive: b.getLifecycleSnapshot().state === 'running' && second.querySelectorAll('details').length === 1 };
    } finally {
      release();
      await a.shutdown();
      await b.shutdown();
      first.remove();
      second.remove();
    }
  }, root);
  expect(result).toEqual({ actualMaterial: true, independent: true, pendingInert: true,
    lateInert: true, borrowed: true, secondLive: true });
  expect(await detailsListeners(page)).toBe(0);
});
