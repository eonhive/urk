/**
 * Company: EonHive Inc. | Title: Video Visibility Integration
 * Purpose: Verify deferred loading, explicit resume, cancellation, and observer cleanup in both hosts.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Page } from '@playwright/test';
import { observeMedia, resources, audioResources } from './media-probe';

async function observeVisibility(page: Page) {
  await observeMedia(page);
  await page.addInitScript(() => {
    const probe = { observers: new Set<IntersectionObserver>(), visible: false };
    Object.assign(window, { visibilityProbe: probe });
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          for (const entry of entries) {
            if (entry.target.matches('.video-card, .media-layout'))
              probe.visible = entry.isIntersecting && entry.intersectionRatio > 0;
          }
          callback(entries, observer);
        }, options);
      }
      observe(target: Element) {
        if (target.matches('.video-card, .media-layout')) probe.observers.add(this);
        super.observe(target);
      }
      disconnect() { probe.observers.delete(this); super.disconnect(); }
    };
  });
}
const observed = (page: Page) => page.evaluate(() => (window as any).visibilityProbe.observers.size);
const visible = (page: Page) => page.evaluate(() => (window as any).visibilityProbe.visible);
async function settleFrame(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;

for (const [host, base] of [['standalone', proof], ['website', `${website}/examples`]]) {
  test(`${host}: offscreen players defer loading, stay paused on return, and release observers`, async ({ page }) => {
    await observeVisibility(page);
    const url = `${base}/video-proof/`;
    await page.route(url, async route => {
      const response = await route.fetch();
      const html = await response.text();
      await route.fulfill({ response, body: html.replace('</head>', '<style>.urk-video-proof{margin-top:160vh!important}</style></head>') });
    });
    const mediaRequests: string[] = [];
    page.on('request', request => { if (request.url().endsWith('/video/orbit.mp4')) mediaRequests.push(request.url()); });
    await page.goto(url);
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect.poll(() => observed(page)).toBe(2);
    await settleFrame(page);
    expect(mediaRequests).toHaveLength(0);
    for (const video of await page.locator('.video-card video').all()) await expect(video).not.toHaveAttribute('src');
    const first = page.getByRole('region', { name: 'Player 1', exact: true });
    const video = first.locator('video');
    await first.scrollIntoViewIfNeeded();
    await expect(video).toHaveAttribute('src', '/video/orbit.mp4');
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await first.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => visible(page)).toBe(false);
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await first.scrollIntoViewIfNeeded();
    await expect.poll(() => visible(page)).toBe(true);
    await settleFrame(page);
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await first.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await observed(page)).toBe(0);
    expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
  });

  test(`${host}: hidden media cancels pending play and sound, with explicit resume and fresh recovery`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeVisibility(page);
    await page.goto(`${base}/interactive-media/`);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    const video = page.locator('.media-layout video');
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await page.evaluate(() => { (window as any).videoProbe.hold = true; });
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).videoProbe.held)).toBe(1);
    // Explicitly deliver the browser visibility signal; no reliance on headless tab activation.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await expect.poll(async () => (await audioResources(page)).playing).toBe(0);
    await page.evaluate(() => {
      const probe = (window as any).videoProbe;
      probe.hold = false;
      probe.release.splice(0).forEach((release: () => void) => release());
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settleFrame(page);
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    expect((await audioResources(page)).playing).toBe(0);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${host}-mobile.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await observed(page)).toBe(0);
    expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect.poll(() => observed(page)).toBe(1);
    expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect.poll(() => observed(page)).toBe(0);
  });
}
