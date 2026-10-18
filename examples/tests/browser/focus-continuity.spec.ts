/**
 * Company: EonHive Inc.
 * Title: Playground Host Focus Continuity
 * Purpose: Verify focus survives control replacement without overriding newer user focus.
 * Author: Stan Nesi
 * Created: 2026-10-13
 * Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeScene } from './rendering-probe';

test.use({ baseURL: process.env.URK_FOCUS_BASE_URL ?? 'http://127.0.0.1:5174' });

async function replaceControls(page: Page, name: string, state = 'running', key = 'Enter'): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  const previous = await button.elementHandle();
  await button.focus();
  await button.press(key);
  await page.waitForFunction(element => !element!.isConnected, previous);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText(state);
  await expect(button).toBeFocused();
  await expect(page.locator('.workbench-controls')).toHaveCount(1);
  await expect(page.locator('.v02-controls-host > .workbench-controls')).toHaveCount(1);
}

async function holdPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixture = { pending: false, release: () => {} };
    Object.assign(window, { focusPlayback: fixture });
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      play(): Promise<void> {
        fixture.pending = true;
        return new Promise(resolve => {
          fixture.release = () => { fixture.pending = false; resolve(); };
        });
      }
    };
  });
}

for (const [host, url] of [
  ['standalone', '/v02/'],
  ['React', '/v02/react.html'],
  ['Next', 'http://127.0.0.1:3102/v02'],
]) {
  test(`${host}: Pause and Resume keep native keyboard focus on the available action`, async ({ page, browserName }) => {
    await observeScene(page);
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    const resume = page.getByRole('button', { name: 'Resume', exact: true });
    const viewport = page.getByRole('group', { name: 'Interactive objects' });
    await page.locator('[data-card="Create"]').press('Enter');
    await page.getByRole('slider', { name: 'Selected object rotation' }).fill('75');
    await pause.focus();
    for (const key of ['Enter', 'Space', 'Enter', 'Space']) {
      // Send keys to the focused element, not to a locator that would refocus it for us.
      await page.keyboard.press(key);
      await expect(page.getByTestId('v02-lifecycle')).toHaveText('paused');
      await expect(pause).toBeDisabled();
      await expect(resume).toBeFocused();
      await expect(viewport).toHaveAttribute('data-render-pending', 'false');
      await page.keyboard.press(key);
      await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
      await expect(resume).toBeDisabled();
      await expect(pause).toBeFocused();
      await expect(viewport).toHaveAttribute('data-selected', 'Create');
      await expect(viewport).toHaveAttribute('data-rotation', '0.20,1.31');
      await expect(viewport).toHaveAttribute('data-render-pending', 'false');
    }
    // macOS WebKit uses Option-Tab to include buttons in native keyboard navigation.
    const tabModifier = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+' : '';
    await page.keyboard.press(`${tabModifier}Tab`);
    await expect(page.getByRole('button', { name: 'Start fresh', exact: true })).toBeFocused();
    await page.keyboard.press(`${tabModifier}Shift+Tab`);
    await expect(pause).toBeFocused();
    await page.getByRole('button', { name: 'Unmount', exact: true }).press('Enter');
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    await expect(page.getByRole('button', { name: 'Unmount', exact: true })).toBeFocused();
    expect(await page.evaluate(() => (window as any).renderingProbe.frames.size)).toBe(0);
  });

  test(`${host}: keyboard restart, failure recovery, and unmount retain useful focus`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeScene(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(url);
    await expect(page.getByTestId('v02-phase')).toHaveText('ready');
    await expect(page.locator('body')).toBeFocused();
    await page.locator('[data-card="Create"]').press('Enter');
    await replaceControls(page, 'Start fresh');
    await expect(page.locator('[data-card="Create"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    const scene = page.getByRole('group', { name: 'Interactive objects' });
    const inspector = page.getByRole('complementary', { name: 'Runtime inspector' });
    const desktopScene = await scene.boundingBox();
    expect((await inspector.boundingBox())!.x).toBeGreaterThanOrEqual(desktopScene!.x + desktopScene!.width);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('focus-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await replaceControls(page, 'Start fresh', 'running', 'Space');
    await expect.poll(() => page.evaluate(() => (window as any).renderingProbe.pixels)).toBeGreaterThan(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const mobileScene = await scene.boundingBox();
    expect((await inspector.boundingBox())!.y).toBeGreaterThanOrEqual(mobileScene!.y + mobileScene!.height);
    if (host === 'standalone') await page.screenshot({ path: info.outputPath('focus-mobile.png'), fullPage: true });

    await replaceControls(page, 'Try setup failure', 'disposed');
    await expect(page.getByTestId('v02-message')).toContainText('Deliberate setup failure');
    await expect(page.locator('canvas')).toHaveCount(0);
    await replaceControls(page, 'Start fresh');
    const unmount = page.getByRole('button', { name: 'Unmount', exact: true });
    await unmount.press('Enter');
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    await expect(unmount).toBeFocused();
    await replaceControls(page, 'Start fresh');
    await expect(page.locator('canvas')).toHaveCount(1);
    await unmount.press('Space');
    await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    await expect(unmount).toBeFocused();
    expect(await page.evaluate(() => {
      const probe = (window as any).renderingProbe;
      return { frames: probe.frames.size, observers: probe.observers.size };
    })).toEqual({ frames: 0, observers: 0 });
    expect(errors).toEqual([]);
  });

  for (const destination of ['outside', 'another control']) {
    test(`${host}: pending restart respects focus moved to ${destination}`, async ({ page }) => {
      await holdPlayback(page);
      await page.goto(url);
      await expect(page.getByTestId('v02-phase')).toHaveText('ready');
      await page.evaluate(() => {
        const button = document.createElement('button');
        button.textContent = 'Outside experience';
        document.body.append(button);
      });
      await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as any).focusPlayback.pending)).toBe(true);
      const restart = page.getByRole('button', { name: 'Start fresh', exact: true });
      const previous = await restart.elementHandle();
      await restart.press('Enter');
      await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposing');
      const destinationButton = page.getByRole('button', {
        name: destination === 'outside' ? 'Outside experience' : 'Show diagnostics', exact: true,
      });
      await destinationButton.focus();
      await page.evaluate(() => (window as any).focusPlayback.release());
      await page.waitForFunction(element => !element!.isConnected, previous);
      await expect(page.getByTestId('v02-phase')).toHaveText('ready');
      await expect(destinationButton).toBeFocused();
      await expect(restart).not.toBeFocused();
      await expect(page.locator('.workbench-controls, canvas')).toHaveCount(2);
      await page.getByRole('button', { name: 'Unmount', exact: true }).click();
      await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposed');
    });
  }
}

test('detaching controls without replacement cannot move focus to another host or a later mount', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createKernel } = await import(`/@fs${root}packages/core/dist/index.js`);
    const { attachV02Controls } = await import(`/@fs${root}packages/examples/dist/v02/runtime.js`);
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const kernel = createKernel({ frameMode: 'auto' });
    const actions = { restart: () => {}, unmount: () => {} };
    const detachFirst = attachV02Controls(first, kernel, actions);
    const detachSecond = attachV02Controls(second, kernel, actions);
    let detachLater: (() => Promise<void>) | undefined;
    try {
      first.querySelector<HTMLButtonElement>('[data-action="restart"]')!.focus();
      await detachFirst();
      const afterDetach = document.activeElement === document.body;
      const detachReplacement: () => Promise<void> = attachV02Controls(first, kernel, actions);
      detachLater = detachReplacement;
      const afterMount = document.activeElement === document.body;
      const outside = second.querySelector<HTMLButtonElement>('[data-action="restart"]')!;
      outside.focus();
      await detachReplacement();
      return { afterDetach, afterMount, keptOutside: document.activeElement === outside,
        releasedClass: !first.classList.contains('v02-controls-host'),
        keptOtherClass: second.classList.contains('v02-controls-host') };
    } finally {
      await detachFirst();
      await detachLater?.();
      await detachSecond();
      await kernel.shutdown();
      first.remove();
      second.remove();
    }
  }, root);
  expect(result).toEqual({ afterDetach: true, afterMount: true, keptOutside: true, releasedClass: true, keptOtherClass: true });
});

test('lifecycle updates and actions without focus do not claim focus; observers can redirect it', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const result = await page.evaluate(async root => {
    const { createKernel } = await import(`/@fs${root}packages/core/dist/index.js`);
    const { attachV02Controls } = await import(`/@fs${root}packages/examples/dist/v02/runtime.js`);
    const host = document.createElement('div');
    const outside = document.createElement('button');
    document.body.append(host, outside);
    const kernel = createKernel({ frameMode: 'auto' });
    const detach = attachV02Controls(host, kernel, { restart: () => {}, unmount: () => {} });
    let unsubscribe = () => {};
    try {
      await kernel.boot();
      const pause = host.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
      const resume = host.querySelector<HTMLButtonElement>('[data-action="resume"]')!;
      const diagnostics = host.querySelector<HTMLButtonElement>('[data-action="diagnostics"]')!;
      outside.focus();
      kernel.pause();
      const externalPause = document.activeElement === outside;
      kernel.resume();
      const externalResume = document.activeElement === outside;
      pause.click();
      const unfocusedPause = document.activeElement === outside;
      resume.click();
      const unfocusedResume = document.activeElement === outside;
      pause.focus();
      kernel.pause();
      const noExternalTransfer = document.activeElement !== resume;
      outside.focus();
      kernel.resume();
      pause.focus();
      await kernel.getContext().state.transition('paused', 'focus-test');
      const phaseOnly = document.activeElement === pause && !pause.disabled && resume.disabled;
      await kernel.getContext().state.transition('ready', 'focus-test');
      unsubscribe = kernel.subscribeLifecycle(() => {
        if (kernel.getLifecycleSnapshot().state === 'paused') diagnostics.focus();
        if (kernel.getLifecycleSnapshot().state === 'running') outside.focus();
      });
      pause.click();
      const redirectedPause = document.activeElement === diagnostics;
      resume.focus();
      resume.click();
      const redirectedResume = document.activeElement === outside;
      unsubscribe();
      await detach();
      pause.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const detached = kernel.getLifecycleSnapshot().state === 'running' && document.activeElement === outside;
      return { externalPause, externalResume, unfocusedPause, unfocusedResume, noExternalTransfer,
        phaseOnly, redirectedPause, redirectedResume, detached };
    } finally {
      unsubscribe();
      await detach();
      await kernel.shutdown();
      host.remove();
      outside.remove();
    }
  }, root);
  expect(result).toEqual({ externalPause: true, externalResume: true, unfocusedPause: true,
    unfocusedResume: true, noExternalTransfer: true, phaseOnly: true, redirectedPause: true,
    redirectedResume: true, detached: true });
});
