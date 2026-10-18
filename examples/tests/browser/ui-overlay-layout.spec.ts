/**
 * Company: EonHive Inc.
 * Title: UI Overlay Layout Contracts
 * Purpose: Keep long panel content and dismissal reachable in bounded hosts.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const base = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const repo = fileURLToPath(new URL('../../../', import.meta.url));
type LayoutWindow = typeof window & {
  overlayLayout: {
    addPanel(id: string): void;
    counts(): { mounts: number; cleanups: number; actions: number; sceneClicks: number };
    teardown(): Promise<void>;
  };
};

async function mountPanels(page: Page, size: { width: number; height: number }, textOnly = false): Promise<void> {
  await page.goto(`${base}/tests/fixtures/index.html`);
  await page.evaluate(async ({ repo, size, textOnly }) => {
    const { createKernel } = await import(`/@fs${repo}packages/core/dist/index.js`);
    const { createUiOverlayAdapter, UiOverlayCapability } = await import(`/@fs${repo}packages/adapters/dist/ui-overlay/index.js`);
    document.body.style.cssText = 'margin:16px;min-height:1600px';
    const opener = document.createElement('button');
    opener.textContent = 'Open details';
    const host = document.createElement('div');
    host.dataset.layoutHost = '';
    host.style.cssText = `position:relative;width:${size.width}px;height:${size.height}px;margin-top:16px;background:#1e293b`;
    const next = document.createElement('button');
    next.textContent = 'Continue page';
    document.body.append(opener, host, next);
    opener.focus();
    let mounts = 0;
    let cleanups = 0;
    let actions = 0;
    let sceneClicks = 0;
    host.addEventListener('click', () => sceneClicks++);
    const kernel = createKernel({ frameMode: 'auto', services: { 'ui:host': host }, adapters: [createUiOverlayAdapter()] });
    await kernel.boot();
    const ui = kernel.getContext().require(UiOverlayCapability);
    const addPanel = (id: string): void => {
      ui.open({ id, kind: 'panel', title: `Details ${id}`, placement: 'bottom-end', mount(container: HTMLElement) {
        mounts++;
        const first = document.createElement('button');
        first.textContent = `First action ${id}`;
        const description = document.createElement('p');
        description.textContent = 'Long project details remain readable inside their own panel. '.repeat(40);
        const identifier = document.createElement('p');
        identifier.textContent = 'long-project-identifier-'.repeat(15);
        const last = document.createElement('button');
        last.textContent = `Last action ${id}`;
        const act = (): void => { actions++; };
        last.addEventListener('click', act);
        if (textOnly) container.append(description, identifier);
        else container.append(first, description, identifier, last);
        return () => { cleanups++; last.removeEventListener('click', act); };
      } });
    };
    (window as LayoutWindow).overlayLayout = {
      addPanel, counts: () => ({ mounts, cleanups, actions, sceneClicks }), teardown: () => kernel.shutdown(),
    };
    addPanel('one');
  }, { repo, size, textOnly });
}

async function expectWithin(child: Locator, parent: Locator): Promise<void> {
  const bounds = (await child.boundingBox())!;
  const limit = (await parent.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(limit.x - 1);
  expect(bounds.y).toBeGreaterThanOrEqual(limit.y - 1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(limit.x + limit.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(limit.y + limit.height + 1);
}

for (const [name, size] of [
  ['wide', { width: 760, height: 480 }],
  ['narrow', { width: 350, height: 320 }],
  ['short', { width: 760, height: 260 }],
] as const) {
  test(`${name} host keeps long panel content scrollable and Close reachable`, async ({ page, browserName }, info) => {
    await page.setViewportSize({ width: name === 'narrow' ? 390 : 1024, height: 800 });
    await mountPanels(page, size);
    const host = page.locator('[data-layout-host]');
    const panel = page.getByRole('region', { name: 'Details one' });
    const content = panel.locator('[data-overlay-content]');
    const close = panel.getByRole('button', { name: 'Close panel' });
    await expectWithin(panel, host);
    await expectWithin(close, host);
    expect(await content.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const before = await close.boundingBox();
    const center = (await content.boundingBox())!;
    await page.mouse.move(center.x + center.width / 2, center.y + center.height / 2);
    await page.mouse.wheel(0, 180);
    await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    expect(await close.boundingBox()).toEqual(before);
    await content.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150); // Allow native wheel scrolling to settle before checking its boundary.
    expect(await page.evaluate(() => scrollY)).toBe(0);

    await close.focus();
    const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
    await page.keyboard.press(tab);
    await expect(content).toBeFocused();
    await expect(content).toHaveAttribute('role', 'group');
    await expect(content).toHaveAttribute('aria-label', 'Panel content');
    await page.keyboard.press('Home');
    await expect.poll(() => content.evaluate(node => node.scrollTop)).toBe(0);
    await page.keyboard.press('PageDown');
    await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press(tab);
    await expect(panel.getByRole('button', { name: 'First action one' })).toBeFocused();
    await page.keyboard.press(tab);
    const last = panel.getByRole('button', { name: 'Last action one' });
    await expect(last).toBeFocused();
    await expectWithin(last, content);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as LayoutWindow).overlayLayout.counts().actions)).toBe(1);
    await page.screenshot({ path: info.outputPath(`${name}-long-panel.png`) });
    // A normal click must reach Close even after the last content action scrolls into view.
    await close.click();
    await expect(panel).toHaveCount(0);
    await host.click({ position: { x: 8, y: 8 } });
    expect(await page.evaluate(() => (window as LayoutWindow).overlayLayout.counts())).toEqual({ mounts: 1, cleanups: 1, actions: 1, sceneClicks: 1 });
    await page.evaluate(() => (window as LayoutWindow).overlayLayout.teardown());
    await expect(host.locator('[data-urk-overlay]')).toHaveCount(0);
  });
}

test('multiple bottom panels remain reachable and resize without remounting', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await mountPanels(page, { width: 760, height: 480 });
  await page.evaluate(() => (window as LayoutWindow).overlayLayout.addPanel('two'));
  const host = page.locator('[data-layout-host]');
  const first = page.getByRole('region', { name: 'Details one' });
  const second = page.getByRole('region', { name: 'Details two' });
  const close = first.getByRole('button', { name: 'Close panel' });
  await expectWithin(close, host);
  const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await first.getByRole('button', { name: 'Last action one' }).focus();
  await page.keyboard.press(tab);
  const secondClose = second.getByRole('button', { name: 'Close panel' });
  await expect(secondClose).toBeFocused();
  await expectWithin(secondClose, host);
  await secondClose.click();
  await expect(second).toHaveCount(0);
  const action = first.getByRole('button', { name: 'First action one' });
  await action.focus();
  await first.evaluate(node => node.setAttribute('data-preserved', 'yes'));
  await host.evaluate(node => { node.style.width = '350px'; node.style.height = '260px'; });
  await expect(action).toBeFocused();
  await expect(first).toHaveAttribute('data-preserved', 'yes');
  await expectWithin(first, host);
  await page.keyboard.press(tab);
  const last = first.getByRole('button', { name: 'Last action one' });
  await expect(last).toBeFocused();
  await expectWithin(last, first.locator('[data-overlay-content]'));
  await page.keyboard.press('Escape');
  await expect(first).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open details' })).toBeFocused();
  expect(await page.evaluate(() => (window as LayoutWindow).overlayLayout.counts())).toEqual({ mounts: 2, cleanups: 2, actions: 0, sceneClicks: 0 });
  await page.evaluate(() => (window as LayoutWindow).overlayLayout.teardown());
});

test('text-only panels support native keyboard scrolling without trapping page focus', async ({ page, browserName }) => {
  await mountPanels(page, { width: 350, height: 260 }, true);
  const panel = page.getByRole('region', { name: 'Details one' });
  const content = panel.getByRole('group', { name: 'Panel content' });
  await expect(content.getByRole('button')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Close panel' }).focus();
  const modifier = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+' : '';
  await page.keyboard.press(`${modifier}Tab`);
  await expect(content).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect.poll(() => content.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press(`${modifier}Tab`);
  await expect(page.getByRole('button', { name: 'Continue page' })).toBeFocused();
  await page.keyboard.press(`${modifier}Shift+Tab`);
  await expect(content).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open details' })).toBeFocused();
  await page.evaluate(() => (window as LayoutWindow).overlayLayout.teardown());
});
