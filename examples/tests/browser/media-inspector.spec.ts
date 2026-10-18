/**
 * Company: EonHive Inc. | Title: Media Inspector Integration
 * Purpose: Verify on-demand observation, current media state, bounded history, and cleanup.
 * Author: Stan Nesi | Created: 2026-10-15 | Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { observeMedia, resources, audioResources } from './media-probe';

const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;
const panel = (page: Page) => page.getByRole('region', { name: 'Media diagnostics' });
const value = (parent: Locator, label: string) => parent.locator(`dt:text-is("${label}") + dd`);
const timers = (page: Page) => page.evaluate(() => (window as any).inspectorTimers.size as number);

async function open(page: Page, url: string) {
  await observeMedia(page);
  await page.addInitScript(() => {
    const timers = new Set<number>();
    Object.assign(window, { inspectorTimers: timers });
    const interval = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
    Object.assign(window, {
      setInterval(handler: TimerHandler, timeout?: number, ...args: unknown[]) {
        const id = interval(handler, timeout, ...args);
        if (timeout === 200) timers.add(id);
        return id;
      },
      clearInterval(id?: number) { timers.delete(id!); clear(id); },
    });
  });
  await page.goto(url);
  await page.locator('.media-layout, .video-decks').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-lifecycle]')).toHaveText('running');
  expect(await timers(page)).toBe(0);
}
async function inspect(page: Page) {
  const button = page.getByRole('button', { name: 'Show diagnostics', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide diagnostics', exact: true })).toHaveAttribute('aria-expanded', 'true');
  expect(await timers(page)).toBe(1);
}
async function dispose(page: Page) {
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
  await expect(page.locator('.urk-media-inspector')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show diagnostics', exact: true })).toBeDisabled();
  expect(await timers(page)).toBe(0);
  expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
  expect(await audioResources(page)).toEqual({ frames: 0, playing: 0, sources: 0, listeners: 0 });
}

for (const [host, base] of [['standalone', proof], ['website', `${website}/examples`]]) {
  test(`${host}: story inspection is opt-in, observes cues and seeks, and stops collecting when closed`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page, `${base}/interactive-media/`);
    await inspect(page);
    await expect(value(panel(page), 'Lifecycle')).toHaveText('running');
    await expect(value(panel(page), 'Kernel frames')).toHaveText('0');
    await expect(value(panel(page), 'Scheduler')).toHaveText('Stopped');
    await expect(value(panel(page), 'Controllers')).toContainText('interactive-media · started');
    await page.getByLabel('Playback position', { exact: true }).fill('1.8');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(value(panel(page), 'Last cue')).toHaveText('00:02 / The signal');
    await page.locator('[data-branch=create]').click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(value(panel(page), 'Direction')).toHaveText('create');
    await expect.poll(async () => (await resources(page)).frames).toBe(0);
    const video = page.locator('.media-layout video');
    // End native pause notifications before comparing the observed history.
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await page.getByRole('button', { name: 'Hide diagnostics', exact: true }).click();
    expect(await timers(page)).toBe(0);
    await expect(page.locator('[data-inspector-events]')).toBeEmpty();
    await page.getByLabel('Playback position', { exact: true }).fill('3.4');
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.seeking)).toBe(false);
    // A distinctive event while closed must not enter the existing inspector's history.
    await video.evaluate(element => element.dispatchEvent(new Event('stalled')));
    await inspect(page);
    await expect(value(panel(page), 'Media time')).toHaveText('3.4 / 8.0');
    await expect(panel(page).locator('[data-inspector-events]')).not.toContainText('video:stalled');
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await expect(value(panel(page), 'Kernel frames')).toHaveText('0');
    if (info.project.name === 'chromium') {
      await panel(page).focus();
      await page.keyboard.press('End');
      await expect.poll(() => panel(page).evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press('Home');
      await expect.poll(() => panel(page).evaluate(element => element.scrollTop)).toBe(0);
      await page.locator('.urk-interactive-media').screenshot({ path: info.outputPath(`${host}-inspector-desktop.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await panel(page).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await panel(page).screenshot({ path: info.outputPath(`${host}-inspector-mobile.png`) });
    }
    await dispose(page);
    expect(errors).toEqual([]);
  });

  test(`${host}: independent players expose buffering and errors with bounded metadata history`, async ({ page }) => {
    await open(page, `${base}/video-proof/`);
    await inspect(page);
    await expect(panel(page).locator('[data-player-id]')).toHaveCount(2);
    const first = page.getByRole('region', { name: 'Player 1', exact: true });
    const video = first.locator('video');
    await first.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(value(panel(page).locator('[data-player-id=player-1]'), 'State')).toHaveText('playing');
    await expect.poll(() => page.getByRole('region', { name: 'Player 2', exact: true }).locator('video').evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    // Deliver a controlled native buffering event without depending on network timing.
    await video.evaluate(element => element.dispatchEvent(new Event('waiting')));
    await expect(value(panel(page).locator('[data-player-id=player-1]'), 'State')).toHaveText('buffering');
    await first.getByRole('button', { name: 'Pause', exact: true }).click();
    await video.evaluate(element => {
      for (let index = 0; index < 100; index++) element.dispatchEvent(new Event('timeupdate'));
    });
    await expect(panel(page).locator('[data-inspector-events] li')).toHaveCount(8);
    await video.evaluate((element: HTMLVideoElement) => { element.src = 'data:video/mp4;base64,YmFk'; element.load(); });
    await expect(value(panel(page).locator('[data-player-id=player-1]'), 'Error')).toContainText('MediaError');
    await expect(value(panel(page).locator('[data-player-id=player-2]'), 'Error')).toHaveText('None');
    await dispose(page);
  });

  test(`${host}: showcase recovery, fresh kernels, and unmount release diagnostics`, async ({ page }) => {
    await open(page, `${base}/experience-showcase/`);
    await inspect(page);
    await page.getByLabel('Playback position', { exact: true }).fill('7.8');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(value(panel(page), 'Scene')).toHaveText('gallery');
    await expect(page.locator('[data-gallery] canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'Pause experience', exact: true }).click();
    await expect(value(panel(page), 'Lifecycle')).toHaveText('paused');
    await page.getByRole('button', { name: 'Resume experience', exact: true }).click();
    await page.locator('.media-layout video').evaluate((element: HTMLVideoElement) => { element.src = 'data:video/mp4;base64,YmFk'; element.load(); });
    await expect(value(panel(page), 'Recovery')).toContainText('failed');
    await expect(value(panel(page), 'Last failure')).toContainText('MediaError');
    await page.getByRole('button', { name: 'Retry video', exact: true }).click();
    await expect(value(panel(page), 'Recovery')).toHaveText('None');
    await expect(value(panel(page), 'Last failure')).toHaveText('None');
    await dispose(page);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    expect(await timers(page)).toBe(0);
    await inspect(page);
    await expect(page.locator('.urk-media-inspector')).toHaveCount(1);
    await expect(panel(page).locator('[data-inspector-events]')).not.toContainText('video:error');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(page.locator('.urk-media-inspector')).toHaveCount(0);
    expect(await timers(page)).toBe(0);
    expect((await resources(page)).frames).toBe(0);
  });
}
