/**
 * Company: EonHive Inc.
 * Title: UI Overlay Browser Contracts
 * Purpose: Verify real DOM ownership, compatibility, snapshots, and selection reuse.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const base = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const urls = {
  core: `/@fs${repo}packages/core/dist/index.js`,
  overlay: `/@fs${repo}packages/adapters/dist/ui-overlay/index.js`,
  loading: `/@fs${repo}packages/adapters/dist/loading/index.js`,
  selection: `/@fs${repo}packages/examples/dist/selection-details/mount.js`,
};

type RetryWindow = typeof window & {
  retryProbe: { resolve(): void; reject(): void; requestCount(): number; teardown(): Promise<void> };
};

test('overlay handles own one instance, preserve aliases, and release content despite cleanup failures', async ({ page }) => {
  await page.goto(`${base}/tests/fixtures/index.html`);
  const result = await page.evaluate(async urls => {
    const { createKernel } = await import(urls.core);
    const { createUiOverlayAdapter, createUiWidgetsAdapter, UiOverlayCapability, UiWidgetsCapability } = await import(urls.overlay);
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const first = createKernel({ frameMode: 'auto', services: { 'ui:host': a }, adapters: [createUiOverlayAdapter()] });
    const second = createKernel({ frameMode: 'auto', services: { 'ui:host': b }, adapters: [createUiWidgetsAdapter()] });
    await first.boot(); await second.boot();
    const ui = first.getContext().require(UiOverlayCapability);
    const other = second.getContext().require(UiWidgetsCapability);
    const fails = (run: () => unknown): boolean => { try { run(); return false; } catch { return true; } };
    const identity = createUiOverlayAdapter === createUiWidgetsAdapter && UiOverlayCapability === UiWidgetsCapability;
    ui.setStatus('Ready');
    ui.showCallout({ title: 'Legacy', body: 'Compatible' });
    const legacy = a.querySelector('[data-overlay-status]')!.textContent === 'Ready' && a.querySelector('[data-overlay-callout]')!.textContent === 'LegacyCompatible';
    ui.hideCallout();
    let notifications = 0;
    ui.subscribe(() => { throw new Error('Observer only'); });
    const unsubscribe = ui.subscribe(() => notifications++);
    const handle = ui.open({ id: 'same', kind: 'status', message: 'Loading', progress: 0 });
    const snapshot = ui.getSnapshot();
    const determinateZero = a.querySelector('progress')!.getAttribute('value') === '0';
    const observer = new MutationObserver(() => {});
    observer.observe(a, { childList: true, subtree: true, attributes: true, characterData: true });
    handle.update({ message: 'Loading', progress: 0 });
    const unchangedDom = observer.takeRecords().length === 0;
    observer.disconnect();
    const stable = snapshot === ui.getSnapshot();
    const frozen = Object.isFrozen(snapshot) && Object.isFrozen(snapshot.overlays) && Object.isFrozen(snapshot.overlays[0]);
    const duplicate = fails(() => ui.open({ id: 'same', kind: 'status', message: 'Duplicate' }));
    const invalidProgress = fails(() => handle.update({ progress: 2 }));
    handle.close(); handle.close();
    const current = ui.open({ id: 'same', kind: 'status', message: 'New' });
    handle.close();
    const stale = fails(() => handle.update({ message: 'Old' })) && ui.getSnapshot().overlays[0].message === 'New';
    const independent = other.open({ id: 'same', kind: 'status', message: 'Other' });
    let cleaned = 0;
    const panel = ui.open({ id: 'panel', kind: 'panel', title: 'Content', mount(container: HTMLElement) {
      container.textContent = 'Mounted';
      return () => { cleaned++; throw new Error('Expected cleanup failure'); };
    } });
    const serializable = !JSON.stringify(ui.getSnapshot()).includes('mount') && ui.getSnapshot().overlays.every((item: object) => Object.values(item).every(value => typeof value !== 'function' && !(value instanceof Node)));
    const cleanupFailed = fails(() => panel.close());
    panel.close();
    const mountFailed = fails(() => ui.open({ id: 'broken', kind: 'panel', title: 'Broken', mount() { throw new Error('Mount failed'); } }));
    const noPartialPanel = a.querySelectorAll('[data-kind="panel"]').length === 0;
    unsubscribe();
    const before = notifications;
    current.update({ message: 'Done' });
    const unsubscribed = notifications === before;
    await first.shutdown();
    ui.setStatus('Late legacy write');
    ui.showCallout({ title: 'Late', body: 'Ignored' });
    ui.hideCallout();
    const disposed = ui.getSnapshot().destroyed && ui.getSnapshot().overlays.length === 0 && a.children.length === 0 && a.isConnected;
    const rejected = fails(() => ui.open({ id: 'late', kind: 'status', message: 'Late' }));
    const isolated = !independent.closed && b.querySelector('[data-overlay-id="same"]')!.textContent === 'Other';
    await second.shutdown();
    a.remove(); b.remove();
    return { identity, legacy, stable, determinateZero, unchangedDom, frozen, duplicate, invalidProgress, stale, serializable, cleanupFailed,
      cleaned, mountFailed, noPartialPanel, unsubscribed, disposed, rejected, isolated, observed: before > 0 };
  }, urls);
  expect(result).toEqual({ identity: true, legacy: true, stable: true, determinateZero: true, unchangedDom: true, frozen: true, duplicate: true, invalidProgress: true,
    stale: true, serializable: true, cleanupFailed: true, cleaned: 1, mountFailed: true, noPartialPanel: true,
    unsubscribed: true, disposed: true, rejected: true, isolated: true, observed: true });
});

test('both views use real actions, retain selection on close, and adapt without remounting', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/selection-details/`);
  const scene = page.locator('[data-proof="scene"]');
  const projects = page.locator('[data-proof="projects"]');
  await expect(scene.locator('[data-details-message]')).toContainText('Orbit explores');
  await scene.getByRole('button', { name: 'Prism', exact: true }).press('Enter');
  const panel = scene.getByRole('region', { name: 'Prism', exact: true });
  const highlight = panel.getByRole('button', { name: 'Highlight node' });
  await expect(highlight).toBeEnabled();
  await highlight.click();
  await expect(scene.locator('[data-select="prism"]')).toHaveAttribute('data-highlight', 'true');
  await expect(scene.locator('.selection-proof')).toHaveAttribute('data-selected', 'prism');
  await expect(projects.locator('.selection-proof')).toHaveAttribute('data-selected', 'orbit');
  await panel.evaluate(node => node.setAttribute('data-preserved', 'yes'));
  await scene.getByRole('button', { name: 'Use light theme' }).click();
  await expect(panel).toHaveAttribute('data-preserved', 'yes');
  expect(await panel.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(248, 250, 252)');
  await scene.getByRole('button', { name: 'Compact host' }).click();
  await expect(panel).toHaveAttribute('data-preserved', 'yes');
  await highlight.focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(highlight).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('selection-mobile.png'), fullPage: true });
  await highlight.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(scene.getByRole('button', { name: 'Prism', exact: true })).toBeFocused();
  await expect(scene.locator('.selection-proof')).toHaveAttribute('data-selected', 'prism');
  await scene.getByRole('button', { name: 'Try details failure' }).click();
  await expect(scene.locator('[data-details-message]')).toContainText('could not load');
  await scene.getByRole('button', { name: 'Retry details' }).click();
  await expect(scene.locator('[data-details-message]')).toContainText('Prism brings');
  await projects.getByRole('button', { name: 'Feature project' }).click();
  await expect(projects.locator('[data-select="orbit"]')).toHaveAttribute('data-highlight', 'true');
  await page.getByRole('button', { name: 'Unmount scene', exact: true }).click();
  await expect(scene.locator('[data-urk-overlay]')).toHaveCount(0);
  await expect(projects.locator('[data-urk-overlay]')).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await expect(projects.locator('[data-urk-overlay]')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(projects.locator('[data-details-message]')).toContainText('Orbit explores');
  await expect(scene.locator('[data-urk-overlay]')).toHaveCount(0);
  await page.getByRole('link', { name: 'About this page' }).click();
  await expect(page).toHaveURL(/#about$/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: info.outputPath('selection-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('late results cannot overwrite a newer selection or reopen closed content', async ({ page }) => {
  await page.goto(`${base}/tests/fixtures/index.html`);
  const result = await page.evaluate(async urls => {
    const { mountSelectionProof } = await import(urls.selection);
    const { LoadingCapability } = await import(urls.loading);
    const host = document.createElement('div');
    document.body.append(host);
    const requests: Array<{ id: string; signal: AbortSignal; resolve(value: string): void }> = [];
    const proof = mountSelectionProof(host, 'projects', { load(item: { id: string }, signal: AbortSignal) {
      return new Promise<string>(resolve => requests.push({ id: item.id, signal, resolve }));
    } });
    await proof.ready;
    const firstPanel = host.querySelector('[data-kind="panel"]');
    host.querySelector<HTMLButtonElement>('[data-select="orbit"]')!.click();
    const sameSelection = requests.length === 1 && !requests[0].signal.aborted && firstPanel === host.querySelector('[data-kind="panel"]');
    host.querySelector<HTMLButtonElement>('[data-select="prism"]')!.click();
    const oldAborted = requests[0].signal.aborted;
    requests[1].resolve('New Prism details');
    await Promise.resolve();
    requests[0].resolve('Stale Orbit details');
    await Promise.resolve();
    const current = host.querySelector('[data-details-message]')!.textContent;
    host.querySelector<HTMLButtonElement>('[data-select="grove"]')!.click();
    host.querySelector<HTMLButtonElement>('[aria-label="Close panel"]')!.click();
    const closeAborted = requests[2].signal.aborted;
    const loading = proof.kernel.getContext().require(LoadingCapability);
    const closeSettled = !loading.getSnapshot().active && host.querySelector('progress')!.hidden;
    const closedStatus = host.querySelector('[data-overlay-id="selection-status"]')!.textContent;
    requests[2].resolve('Closed Grove details');
    await Promise.resolve();
    const stayedClosed = host.querySelectorAll('[data-kind="panel"]').length === 0 &&
      closedStatus === host.querySelector('[data-overlay-id="selection-status"]')!.textContent;
    host.querySelector<HTMLButtonElement>('[data-select="grove"]')!.click();
    const reopened = requests[3].id === 'grove' && loading.getSnapshot().active;
    host.querySelector<HTMLButtonElement>('[data-select="orbit"]')!.click();
    await proof.teardown();
    const unmountAborted = requests[4].signal.aborted;
    requests[4].resolve('Disposed details');
    await Promise.resolve();
    const removed = host.children.length === 0;
    host.remove();
    return { sameSelection, oldAborted, current, closeAborted, closeSettled, closedStatus, stayedClosed, reopened, unmountAborted, removed };
  }, urls);
  expect(result).toEqual({ sameSelection: true, oldAborted: true, current: 'New Prism details', closeAborted: true, closeSettled: true,
    closedStatus: 'Details closed. Your selection is preserved.', stayedClosed: true, reopened: true, unmountAborted: true, removed: true });
});

test('keyboard retry keeps focus while pending and only hands it to the ready action when still focused', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/tests/fixtures/index.html`);
  await page.evaluate(async urls => {
    const { mountSelectionProof } = await import(urls.selection);
    const host = document.createElement('div');
    document.body.append(host);
    const requests: Array<{ resolve(value: string): void; reject(error: Error): void }> = [];
    const proof = mountSelectionProof(host, 'projects', { load() {
      return new Promise<string>((resolve, reject) => requests.push({ resolve, reject }));
    } });
    await proof.ready;
    (window as RetryWindow).retryProbe = {
      resolve: () => requests[requests.length - 1].resolve('Ready after retry'),
      reject: () => requests[requests.length - 1].reject(new Error('Expected details failure')),
      requestCount: () => requests.length,
      teardown: () => proof.teardown(),
    };
  }, urls);
  const panel = page.getByRole('region', { name: 'Orbit', exact: true });
  await panel.evaluate(node => node.setAttribute('data-preserved', 'yes'));
  const content = panel.locator('[data-overlay-content]');
  const action = panel.getByRole('button', { name: 'Feature project' });
  await expect(content).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => (window as RetryWindow).retryProbe.reject());
  const retry = panel.getByRole('button', { name: 'Retry details' });
  await expect(retry).toBeVisible();
  await retry.focus();
  await page.keyboard.press('Enter');
  const pending = panel.getByRole('button', { name: 'Retrying…' });
  await expect(pending).toBeFocused();
  await expect(pending).toHaveAttribute('aria-disabled', 'true');
  await expect(content).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as RetryWindow).retryProbe.requestCount())).toBe(2);
  await page.evaluate(() => (window as RetryWindow).retryProbe.reject());
  await expect(retry).toBeFocused();
  await page.keyboard.press('Space');
  await expect(pending).toBeFocused();
  await page.evaluate(() => (window as RetryWindow).retryProbe.resolve());
  await expect(action).toBeFocused();
  await expect(content).toHaveAttribute('aria-busy', 'false');
  await expect(retry).toBeHidden();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-select="orbit"]')).toHaveAttribute('data-highlight', 'true');
  await page.getByRole('button', { name: 'Try details failure' }).click();
  await expect(panel).toHaveAttribute('data-preserved', 'yes');
  await expect(retry).toBeVisible();
  await retry.focus();
  await page.keyboard.press('Enter');
  const outside = page.getByRole('button', { name: 'Use light theme' });
  await outside.focus();
  await page.evaluate(() => (window as RetryWindow).retryProbe.resolve());
  await expect(action).toBeEnabled();
  await expect(outside).toBeFocused();
  await expect(action).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => (window as RetryWindow).retryProbe.teardown());
  expect(errors).toEqual([]);
});

test('panel placement updates retain content, text selection, and local keyboard focus', async ({ page }) => {
  await page.goto(`${base}/tests/fixtures/index.html`);
  const result = await page.evaluate(async urls => {
    const { createKernel } = await import(urls.core);
    const { createUiOverlayAdapter, UiOverlayCapability } = await import(urls.overlay);
    const host = document.createElement('div');
    host.style.cssText = 'position:relative;width:700px;height:700px';
    const opener = document.createElement('button');
    opener.textContent = 'Open editor';
    document.body.append(opener, host);
    opener.focus();
    const kernel = createKernel({ frameMode: 'auto', services: { 'ui:host': host }, adapters: [createUiOverlayAdapter()] });
    await kernel.boot();
    let mounts = 0;
    let cleanups = 0;
    const input = document.createElement('input');
    input.value = 'Selected project';
    const ui = kernel.getContext().require(UiOverlayCapability);
    const panel = ui.open({ id: 'editor', kind: 'panel', title: 'Editor', mount(container: HTMLElement) {
      mounts++;
      container.append(input);
      return () => { cleanups++; };
    } });
    input.focus();
    input.setSelectionRange(2, 8, 'backward');
    panel.update({ placement: 'bottom-end', title: 'Project editor' });
    const focusPreserved = document.activeElement === input;
    const selectionPreserved = input.selectionStart === 2 && input.selectionEnd === 8 && input.selectionDirection === 'backward';
    const placed = input.closest('[data-placement]')!.getAttribute('data-placement');
    opener.focus();
    panel.update({ placement: 'top-end' });
    const outsidePreserved = document.activeElement === opener;
    input.focus();
    panel.close();
    const returnedToOpener = document.activeElement === opener;
    await kernel.shutdown();
    host.remove(); opener.remove();
    return { mounts, cleanups, focusPreserved, selectionPreserved, placed, outsidePreserved, returnedToOpener };
  }, urls);
  expect(result).toEqual({ mounts: 1, cleanups: 1, focusPreserved: true, selectionPreserved: true,
    placed: 'bottom-end', outsidePreserved: true, returnedToOpener: true });
});

test('panel actions and closing clicks stay local, including destruction during input', async ({ page }) => {
  await page.goto(`${base}/tests/fixtures/index.html`);
  const result = await page.evaluate(async urls => {
    const { createKernel } = await import(urls.core);
    const { createUiOverlayAdapter, UiOverlayCapability } = await import(urls.overlay);
    const host = document.createElement('div');
    host.style.cssText = 'position:relative;width:600px;height:600px';
    document.body.append(host);
    let sceneClicks = 0;
    host.addEventListener('click', () => sceneClicks++);
    const kernel = createKernel({ frameMode: 'auto', services: { 'ui:host': host }, adapters: [createUiOverlayAdapter()] });
    await kernel.boot();
    const ui = kernel.getContext().require(UiOverlayCapability);
    let cleanups = 0;
    const open = (id: string, action: () => void) => ui.open({ id, kind: 'panel', title: id, mount(container: HTMLElement) {
      const button = document.createElement('button');
      button.textContent = 'Action';
      button.addEventListener('click', action);
      container.append(button);
      return () => { cleanups++; button.removeEventListener('click', action); };
    } });
    const panel = open('first', () => panel.close());
    host.querySelector<HTMLButtonElement>('[data-overlay-content] button')!.click();
    open('second', () => {});
    host.querySelector<HTMLButtonElement>('[aria-label="Close panel"]')!.click();
    open('third', () => ui.destroy());
    host.querySelector<HTMLButtonElement>('[data-overlay-content] button')!.click();
    const isolated = sceneClicks === 0;
    host.click();
    const sceneStillWorks = sceneClicks === 1;
    await kernel.shutdown();
    const empty = host.children.length === 0;
    host.remove();
    return { isolated, sceneStillWorks, cleanups, empty };
  }, urls);
  expect(result).toEqual({ isolated: true, sceneStillWorks: true, cleanups: 3, empty: true });
});

for (const slug of ['scene-ui-bridge', 'project-selection']) {
  test(`website ${slug} mounts and restarts the shared proof`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}/examples/${slug}/`);
    const root = page.locator('urk-selection-example');
    await expect(root.locator('[data-details-message]')).toContainText('Orbit explores');
    await root.getByRole('button', { name: 'Prism', exact: true }).click();
    await expect(root.getByRole('region', { name: 'Prism', exact: true })).toBeVisible();
    await root.getByRole('button', { name: 'Restart example' }).click();
    await expect(root.locator('[data-details-message]')).toContainText('Orbit explores');
    await expect(root.locator('[data-urk-overlay]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
