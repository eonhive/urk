/**
 * Company: EonHive Inc. | Title: Shared Video Gallery Integration
 * Purpose: Verify video rendering, gallery navigation, cancellation, and native resource cleanup.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Page } from '@playwright/test';
import { observeMedia, resources, audioResources } from './media-probe';

async function observeGallery(page: Page) {
  await observeMedia(page);
  await page.addInitScript(() => {
    const probe = { callbacks: new Map<HTMLVideoElement, Set<number>>(), draws: 0 };
    Object.assign(window, { galleryProbe: probe });
    const proto = HTMLVideoElement.prototype;
    const request = proto.requestVideoFrameCallback;
    const cancel = proto.cancelVideoFrameCallback;
    if (request) {
      proto.requestVideoFrameCallback = function (callback) {
        let pending = probe.callbacks.get(this);
        if (!pending) probe.callbacks.set(this, pending = new Set());
        const id = request.call(this, (now, metadata) => { pending!.delete(id); callback(now, metadata); });
        pending.add(id);
        return id;
      };
      proto.cancelVideoFrameCallback = function (id) { probe.callbacks.get(this)?.delete(id); cancel.call(this, id); };
    }
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      probe.draws++;
      return draw.apply(this, args);
    };
  });
}
const callbacks = (page: Page) => page.evaluate(() => [...(window as any).galleryProbe.callbacks.values()].reduce((sum: number, set: any) => sum + set.size, 0));
const draws = (page: Page) => page.evaluate(() => (window as any).galleryProbe.draws as number);
async function ending(page: Page) {
  await page.locator('.media-layout').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-lifecycle]')).toHaveText('running');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await page.getByLabel('Playback position', { exact: true }).fill('7.8');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
}
async function enter(page: Page) {
  await ending(page);
  await page.getByRole('button', { name: 'Enter 3D gallery', exact: true }).click();
  await expect(page.locator('[data-gallery] canvas')).toHaveCount(1);
  await expect(page.locator('[data-gallery-status]')).toContainText('Select an object');
  await expect(page.locator('.media-screen')).not.toHaveAttribute('data-transition');
}
const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;
for (const [host, base] of [['standalone', proof], ['website', `${website}/examples`]]) {
  test(`${host}: gallery renders video, picks objects, mirrors captions, pauses and releases`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeGallery(page);
    await page.goto(`${base}/interactive-media/`);
    await enter(page);
    await expect.poll(() => draws(page)).toBeGreaterThan(0);
    const surface = page.locator('[data-gallery-surface]');
    await surface.focus();
    await page.keyboard.press('2');
    await expect(page.locator('[data-branch=create]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const bounds = (await surface.boundingBox())!;
    const aspect = bounds.width / bounds.height;
    const tangent = Math.tan(21 * Math.PI / 180);
    const z = Math.max(6.5, 3.3 / tangent / aspect) - 0.4;
    await surface.click({ position: { x: bounds.width * (0.5 - 2.35 / (z * tangent * aspect) / 2), y: bounds.height * (0.5 + 0.35 / (z * tangent) / 2) } });
    await expect(page.locator('[data-gallery-branch=explore]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByLabel('English captions', { exact: true }).check();
    await page.getByLabel('Playback position', { exact: true }).fill('1');
    await expect(page.locator('[data-gallery-caption]')).toContainText('Three colored lights');
    await expect(page.locator('[data-gallery-title]')).toHaveText('A new perspective.');
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await expect.poll(async () => (await audioResources(page)).playing).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Replay screen', exact: true }).click();
    const before = await draws(page);
    await expect.poll(() => draws(page)).toBeGreaterThan(before + 10);
    await page.getByRole('button', { name: 'Pause experience', exact: true }).click();
    await expect.poll(async () => (await resources(page)).frames).toBe(0);
    const paused = await draws(page);
    await page.waitForTimeout(180);
    expect(await draws(page)).toBe(paused);
    expect((await audioResources(page)).playing).toBe(0);
    await page.getByRole('button', { name: 'Resume experience', exact: true }).click();
    await expect.poll(async () => (await resources(page)).frames).toBe(0);
    expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.locator('.urk-interactive-media').screenshot({ path: info.outputPath('gallery-desktop.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.urk-interactive-media').screenshot({ path: info.outputPath('gallery-mobile.png') });
    }
    await page.locator('[data-gallery-return]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-film]')).toBeFocused();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(() => callbacks(page)).toBe(0);
    await enter(page);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await callbacks(page)).toBe(0);
    expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
    expect(errors).toEqual([]);
  });

  test(`${host}: showcase hands off automatically, recovers context, and starts fresh silently`, async ({ page }) => {
    await observeGallery(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${base}/experience-showcase/`);
    await ending(page);
    await expect(page.locator('[data-gallery] canvas')).toHaveCount(1);
    await expect(page.locator('[data-gallery-status]')).toContainText('Select an object');
    await page.getByRole('button', { name: 'Replay screen', exact: true }).click();
    const supported = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
      Object.assign(window, { galleryContext: extension });
      extension?.loseContext();
      return Boolean(extension);
    });
    if (supported) {
      await expect(page.locator('[data-gallery-status]')).toContainText('Waiting for recovery');
      expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
      await page.evaluate(() => (window as any).galleryContext.restoreContext());
      await expect(page.locator('[data-gallery-status]')).toContainText('Graphics restored');
    }
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await callbacks(page)).toBe(0);
    expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  });

  test(`${host}: interrupted imports and unavailable WebGL leave the native film usable`, async ({ page }) => {
    await observeGallery(page);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    // Hold the lazy scene import without blocking the startup gallery controller.
    await page.route(url => url.pathname.endsWith('/gallery.js'), async route => { await held; await route.continue(); });
    await page.goto(`${base}/interactive-media/`);
    await ending(page);
    await page.getByRole('button', { name: 'Enter 3D gallery', exact: true }).click();
    await expect(page.locator('[data-gallery-status]')).toContainText('Loading');
    await page.locator('[data-gallery-return]').click();
    await expect(page.locator('[data-film]')).toBeVisible();
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposing');
    release();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await callbacks(page)).toBe(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.evaluate(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
        if (String(args[0]).startsWith('webgl')) return null;
        return (getContext as any).apply(this, args);
      } as typeof getContext;
    });
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await ending(page);
    await page.getByRole('button', { name: 'Enter 3D gallery', exact: true }).click();
    await expect(page.locator('[data-gallery-status]')).toContainText('3D is unavailable');
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await page.locator('[data-gallery-return]').click();
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  });
}

test('gallery uses animation-frame fallback only while video plays', async ({ page }) => {
  await observeGallery(page);
  await page.addInitScript(() => {
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback');
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback');
  });
  await page.goto(`${proof}/interactive-media/`);
  await enter(page);
  await page.getByRole('button', { name: 'Replay screen', exact: true }).click();
  const before = await draws(page);
  await expect.poll(() => draws(page)).toBeGreaterThan(before + 10);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(async () => (await resources(page)).frames).toBe(0);
  const paused = await draws(page);
  await page.waitForTimeout(150);
  expect(await draws(page)).toBe(paused);
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
  expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
});
