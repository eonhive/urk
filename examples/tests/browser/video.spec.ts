/**
 * Company: EonHive Inc. | Title: Native Video Proof Integration
 * Purpose: Exercise real decoding, captions, local media, cancellation, and disposal in both hosts.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { observeMedia, resources } from './media-probe';

const sample = fileURLToPath(new URL('../../public/video/orbit.mp4', import.meta.url));
const captions = fileURLToPath(new URL('../../public/video/orbit.vtt', import.meta.url));
const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;

for (const [name, url] of [
  ['standalone', `${proof}/video-proof/`],
  ['website', `${website}/examples/video-proof/`],
]) {
  test(`${name}: native playback, independent controls, captions, local files, and cleanup`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeMedia(page);
    await page.goto(url);
    await page.locator('.video-card').first().scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    const a = page.getByRole('region', { name: 'Player 1', exact: true });
    const b = page.getByRole('region', { name: 'Player 2', exact: true });
    const video = a.locator('video');
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.duration)).toBe(8);
    expect((await resources(page)).playing).toBe(0);
    await a.getByRole('combobox', { name: 'Captions', exact: true }).selectOption('0');
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.textTracks[0].cues?.length ?? 0)).toBe(3);
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await b.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(0.1);
    await a.getByRole('button', { name: 'Pause', exact: true }).click();
    expect(await b.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
    await b.getByRole('button', { name: 'Pause', exact: true }).click();
    await a.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('1.5');
    await a.getByRole('button', { name: 'Mute', exact: true }).click();
    await a.getByLabel('Loop', { exact: true }).check();
    await a.getByLabel('Volume', { exact: true }).focus();
    await page.keyboard.press('Home');
    expect(
      await video.evaluate((video: HTMLVideoElement) => [video.playbackRate, video.muted, video.loop, video.volume]),
    ).toEqual([1.5, true, true, 0]);
    const seek = a.getByLabel('Playback position', { exact: true });
    await seek.click({ position: { x: (await seek.boundingBox())!.width * 0.5, y: 15 } });
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(2);
    await a.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime)).toBe(0);
    await a.getByLabel('Open local video', { exact: true }).setInputFiles(sample);
    await expect(video).toHaveAttribute('src', /^blob:/);
    await a.getByLabel('Load WebVTT captions', { exact: true }).setInputFiles(captions);
    await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.textTracks[0]?.cues?.length ?? 0)).toBe(3);
    await expect
      .poll(() =>
        video.evaluate(
          (video: HTMLVideoElement) => Array.from(video.textTracks).filter((track) => track.mode === 'showing').length,
        ),
      )
      .toBe(1);
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Pause experience' }).click();
    expect((await resources(page)).playing).toBe(0);
    await expect(a.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Resume experience' }).click();
    expect((await resources(page)).playing).toBe(0);
    await page.getByRole('button', { name: 'Show diagnostics' }).click();
    await a.getByRole('button', { name: 'Unmute', exact: true }).click();
    await expect(page.locator('[data-inspector-events]')).toContainText('video:');
    await page.getByRole('button', { name: 'Hide diagnostics' }).click();
    expect((await resources(page)).frames).toBe(0);
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: info.outputPath(`${name}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${name}-mobile.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    await expect(page.locator('.video-decks video')).toHaveCount(0);
    expect(await resources(page)).toEqual({ urls: 0, frames: 0, playing: 0, sources: 0, listeners: 0 });
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect(page.locator('.video-decks video')).toHaveCount(2);
    expect((await resources(page)).playing).toBe(0);
    expect(errors).toEqual([]);
  });

  test(`${name}: dispose during pending playback and recover from unsupported local media`, async ({
    page,
  }) => {
    await observeMedia(page);
    await page.goto(url);
    await page.locator('.video-card').first().scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    const a = page.getByRole('region', { name: 'Player 1', exact: true });
    await page.evaluate(() => {
      (window as any).videoProbe.hold = true;
    });
    await a.getByRole('button', { name: 'Play', exact: true }).click();
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
    await a
      .getByLabel('Open local video', { exact: true })
      .setInputFiles({ name: 'invalid.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not a video') });
    await expect(a.locator('[data-status]')).toHaveText('error');
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await a.getByRole('button', { name: 'Restore Orbit sample' }).click();
    await a.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(a.locator('[data-status]')).toHaveText('playing');
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect((await resources(page)).urls).toBe(0);
  });
}
