/**
 * Company: EonHive Inc. | Title: Shared Film Recovery Integration
 * Purpose: Exercise native failures, retained preferences, gallery recreation, and cancelled retries.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Page } from '@playwright/test';
import { observeMedia, resources, audioResources } from './media-probe';

const saved = { version: 1, position: 5.2, branch: 'create', captions: true, musicVolume: 0.25, narrationVolume: 0.65 };
const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;
const video = (page: Page) => page.locator('.media-layout video');
const bookmark = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('urk:media:bookmark')!));

async function open(page: Page, url: string) {
  await observeMedia(page);
  await page.addInitScript(value => localStorage.setItem('urk:media:bookmark', JSON.stringify(value)), saved);
  await page.goto(url);
  await page.locator('.media-layout').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-lifecycle]')).toHaveText('running');
}
async function breakFilm(page: Page) {
  // Use the real browser decoder failure, rather than synthesizing a runtime error.
  await video(page).evaluate((element: HTMLVideoElement) => {
    element.src = 'data:video/mp4;base64,YmFk';
    element.load();
  });
  await expect(page.locator('[data-recovery]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry video', exact: true })).toBeEnabled();
}
async function restored(page: Page) {
  await expect(page.locator('[data-recovery]')).toBeHidden();
  await expect(page.locator('[data-result]')).toContainText('Film restored');
  await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(saved.position, 1);
  expect(await video(page).evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await expect(page.locator('[data-branch=create]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('English captions', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Music volume', { exact: true })).toHaveValue('0.25');
  await expect(page.getByLabel('Narration volume', { exact: true })).toHaveValue('0.65');
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeEnabled();
  expect(await bookmark(page)).toMatchObject(saved);
}
async function dispose(page: Page) {
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
  await expect(page.locator('.media-layout')).toHaveCount(0);
  expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
  expect(await audioResources(page)).toEqual({ frames: 0, playing: 0, sources: 0, listeners: 0 });
}

for (const [host, base] of [['standalone', proof], ['website', `${website}/examples`]]) {
  test(`${host}: initial load failure and repeated retry preserve bookmarks, captions, focus, and silent playback`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/video/orbit.mp4', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await open(page, `${base}/interactive-media/`);
    await expect(page.locator('[data-recovery]')).toBeVisible();
    await expect(page.locator('[data-time]')).toHaveText('5.2 / 8.0');
    const retry = page.getByRole('button', { name: 'Retry video', exact: true });
    await retry.click();
    await expect(retry).toBeEnabled();
    expect(await bookmark(page)).toMatchObject(saved);
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 390, height: 844 });
      await retry.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.urk-interactive-media').screenshot({ path: info.outputPath(`${host}-recovery-mobile.png`) });
    }
    await page.unroute('**/video/orbit.mp4');
    await retry.focus();
    await page.keyboard.press('Enter');
    await restored(page);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
    await dispose(page);
    expect(errors).toEqual([]);
  });

  test(`${host}: gallery failure releases graphics and retry rebuilds at the saved chapter without autoplay`, async ({ page }) => {
    await open(page, `${base}/experience-showcase/`);
    await page.getByLabel('Playback position', { exact: true }).fill('7.8');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('[data-gallery] canvas')).toHaveCount(1);
    await expect(page.locator('.media-screen')).not.toHaveAttribute('data-transition');
    const original = await page.locator('[data-gallery] canvas').elementHandle();
    await page.getByLabel('Playback position', { exact: true }).fill(String(saved.position));
    await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.seeking)).toBe(false);
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await breakFilm(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect((await audioResources(page)).playing).toBe(0);
    expect(await bookmark(page)).toMatchObject(saved);
    await page.getByRole('button', { name: 'Retry video', exact: true }).click();
    await restored(page);
    await expect(page.locator('[data-gallery] canvas')).toHaveCount(1);
    expect(await original!.evaluate(canvas => canvas.isConnected)).toBe(false);
    await expect(page.locator('[data-gallery-caption]')).toContainText('move independently');
    await expect(page.locator('[data-gallery-branch=create]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await resources(page)).frames).toBe(0);
    await breakFilm(page);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let requested = false;
    await page.route('**/video/orbit.mp4', async route => { requested = true; await held; await route.continue().catch(() => {}); });
    await page.getByRole('button', { name: 'Retry video', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await page.locator('[data-gallery-return]').click();
    release();
    await page.unroute('**/video/orbit.mp4');
    await expect(page.locator('[data-film]')).toBeVisible();
    await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('[data-recovery]')).toBeVisible();
    await page.getByRole('button', { name: 'Retry video', exact: true }).click();
    await restored(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await video(page).evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(saved.position, 1);
    await dispose(page);
  });

  test(`${host}: cancel, pause, and shutdown prevent late retry activation`, async ({ page }) => {
    await open(page, `${base}/interactive-media/`);
    await expect(page.getByLabel('Playback position', { exact: true })).toBeEnabled();
    await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(saved.position, 1);
    await breakFilm(page);
    for (const action of ['cancel', 'pause', 'dispose']) {
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      let requested = false;
      await page.route('**/video/orbit.mp4', async route => { requested = true; await held; await route.continue().catch(() => {}); });
      await page.getByRole('button', { name: 'Retry video', exact: true }).click();
      await expect.poll(() => requested).toBe(true);
      if (action === 'cancel') await page.getByRole('button', { name: 'Cancel retry', exact: true }).click();
      if (action === 'pause') await page.getByRole('button', { name: 'Pause experience', exact: true }).click();
      if (action === 'dispose') await dispose(page);
      release();
      await page.unroute('**/video/orbit.mp4');
      if (action === 'dispose') break;
      await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(0);
      await expect(page.locator('[data-recovery]')).toBeVisible();
      await expect(page.locator('[data-time]')).toHaveText('5.2 / 8.0');
      expect(await bookmark(page)).toMatchObject(saved);
      expect(await video(page).evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
      if (action === 'pause') await page.getByRole('button', { name: 'Resume experience', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect.poll(() => video(page).evaluate((element: HTMLVideoElement) => element.currentTime)).toBeCloseTo(saved.position, 1);
    expect(await video(page).evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await dispose(page);
  });
}
