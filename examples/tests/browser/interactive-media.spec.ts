/**
 * Company: EonHive Inc. | Title: Interactive Media Integration
 * Purpose: Verify real timed cues, chapter/branch controls, bookmarks, and lifecycle cleanup in both hosts.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';
import { observeMedia, resources } from './media-probe';

const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;
for (const [name, url] of [
  ['standalone', `${proof}/interactive-media/`],
  ['website', `${website}/examples/interactive-media/`],
]) {
  test(`${name}: cues, keyboard chapters, branching, captions, restoration, and disposal`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeMedia(page);
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    const video = page.locator('.urk-interactive-media video');
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.duration)).toBe(8);
    expect(await video.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    expect((await resources(page)).frames).toBe(0);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('[data-cue]')).toHaveText('00:02 / The signal', { timeout: 5000 });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.locator('[data-title]')).toContainText('out there');
    await expect(page.getByRole('button', { name: 'Explore the signal', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Explore the signal', exact: true }).click();
    await expect(page.locator('[data-branch=explore]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-outcome]')).toContainText('You chose to explore', { timeout: 5000 });
    await expect(page.locator('[data-cue]')).toHaveText('Media ended / Journey complete');
    await page.getByRole('button', { name: /02 The signal/ }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime)).toBe(2);
    // A seek changes visible state, without firing skipped timestamp actions.
    await expect(page.locator('[data-cue]')).toHaveText('Media ended / Journey complete');
    await page.getByRole('button', { name: /Create ✧/ }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.locator('[data-title]')).toContainText('Make room');
    await page.getByLabel('English captions', { exact: true }).check();
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.textTracks[0]?.cues?.length ?? 0)).toBe(3);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('urk:media:bookmark')!));
    expect(saved.branch).toBe('create');
    expect(saved.captions).toBe(true);
    expect(saved.position).toBeGreaterThanOrEqual(5);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect(page.locator('[data-branch=create]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(saved.position, 1);
    expect(await video.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    await expect(page.getByLabel('English captions', { exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Pause experience' }).click();
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Resume experience' }).click();
    expect(await video.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await expect(page.locator('[data-cue]')).toHaveText('00:00 / Arrival');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: info.outputPath(`${name}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${name}-mobile.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    await expect(video).toHaveCount(0);
    expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
    expect(errors).toEqual([]);
  });

  test(`${name}: blocked storage, deferred play cancellation, and silent fresh recovery`, async ({
    page,
  }) => {
    await observeMedia(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Blocked', 'SecurityError');
        },
      });
    });
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-storage]')).toHaveText('Session only');
    await page.evaluate(() => {
      (window as any).videoProbe.hold = true;
    });
    await page.getByRole('button', { name: /Create ✧/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).videoProbe.held)).toBe(1);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    await page.evaluate(() => {
      const probe = (window as any).videoProbe;
      probe.hold = false;
      probe.release.forEach((release: () => void) => release());
    });
    await expect
      .poll(() => resources(page))
      .toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-branch=create]')).toHaveAttribute('aria-pressed', 'true');
    expect(
      await page.locator('.urk-interactive-media video').evaluate((video: HTMLVideoElement) => video.paused),
    ).toBe(true);
    await expect(page.locator('[data-storage]')).toHaveText('Session only');
  });
}
