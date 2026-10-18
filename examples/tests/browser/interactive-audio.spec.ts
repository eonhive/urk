/**
 * Company: EonHive Inc. | Title: Interactive Sound Integration
 * Purpose: Verify native opt-in audio, crossfades, narration ducking, cancellation, and silent recovery.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Page } from '@playwright/test';
import { observeMedia, audioResources } from './media-probe';

const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;
async function track(page: Page, name: string) {
  return page.evaluate((name) => {
    const audio = [...(window as any).videoProbe.audio].find((audio: any) =>
      audio.src.includes(`orbit-${name}.wav`),
    ) as HTMLAudioElement;
    return audio ? { paused: audio.paused, volume: audio.volume, muted: audio.muted } : null;
  }, name);
}
async function release(page: Page) {
  await page.evaluate(() => {
    const probe = (window as any).videoProbe;
    probe.holdAudio = false;
    probe.releaseAudio.splice(0).forEach((done: () => void) => done());
  });
}
for (const [name, url] of [
  ['standalone', `${proof}/interactive-media/`],
  ['website', `${website}/examples/interactive-media/`],
]) {
  test(`${name}: opt-in sound, independent levels, narration ducking, branch crossfade, and saved silent recovery`, async ({
    page,
  }, info) => {
    const errors: string[] = [],
      requests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/audio/')) requests.push(request.url());
    });
    await observeMedia(page);
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeEnabled();
    expect(await audioResources(page)).toEqual({
      frames: 0,
      playing: 0,
      sources: 0,
      listeners: 0,
    });
    expect(requests).toEqual([]);
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await expect
      .poll(() => track(page, 'explore'))
      .toEqual({ paused: false, muted: false, volume: 0.35 });
    await page.getByLabel('Music volume', { exact: true }).fill('0.6');
    await page.getByLabel('Narration volume', { exact: true }).fill('0.7');
    await page.getByRole('button', { name: 'Hear the guide' }).click();
    await expect.poll(async () => (await track(page, 'guide'))?.paused).toBe(false);
    await expect.poll(async () => (await track(page, 'explore'))?.volume).toBeCloseTo(0.132, 3);
    expect((await track(page, 'guide'))?.volume).toBe(0.7);
    await expect
      .poll(async () => (await track(page, 'explore'))?.volume, {
        timeout: 6000,
      })
      .toBe(0.6);
    await expect.poll(async () => (await audioResources(page)).frames).toBe(0);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('[data-cue]')).toHaveText('00:02 / The signal');
    await expect.poll(async () => (await track(page, 'guide'))?.paused).toBe(false);
    await page.getByRole('button', { name: /Create ✧/ }).click();
    await expect.poll(async () => (await track(page, 'create'))?.volume).toBe(0.6);
    await expect.poll(async () => (await track(page, 'explore'))?.paused).toBe(true);
    expect((await track(page, 'create'))?.paused).toBe(false);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
    await expect.poll(async () => (await audioResources(page)).playing).toBe(0);
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Music volume', { exact: true })).toHaveValue('0.6');
    await expect(page.getByLabel('Narration volume', { exact: true })).toHaveValue('0.7');
    expect(await audioResources(page)).toEqual({
      frames: 0,
      playing: 0,
      sources: 0,
      listeners: 0,
    });
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.screenshot({
        path: info.outputPath(`${name}-sound-desktop.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`${name}-sound-mobile.png`),
        fullPage: true,
      });
    }
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await audioResources(page)).toEqual({
      frames: 0,
      playing: 0,
      sources: 0,
      listeners: 0,
    });
    expect(errors).toEqual([]);
  });

  test(`${name}: pause, seek, replay, disable, and disposal invalidate pending sound; media errors stay local`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeMedia(page);
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    for (const action of ['pause', 'seek', 'replay', 'disable', 'dispose']) {
      await page.evaluate(() => {
        (window as any).videoProbe.holdAudio = true;
      });
      await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as any).videoProbe.audioHeld)).toBe(1);
      if (action === 'seek') await page.getByLabel('Playback position', { exact: true }).fill('1');
      else
        await page
          .getByRole('button', {
            name: {
              pause: 'Pause experience',
              replay: 'Replay',
              disable: 'Disable sound',
              dispose: 'Dispose',
            }[action],
            exact: true,
          })
          .click();
      expect((await track(page, 'explore'))?.muted).toBe(true);
      if (action === 'dispose')
        await expect(page.locator('[data-lifecycle]')).toHaveText('disposing');
      await release(page);
      await expect.poll(async () => (await audioResources(page)).playing).toBe(0);
      await expect.poll(async () => (await audioResources(page)).frames).toBe(0);
      if (action === 'pause')
        await page.getByRole('button', { name: 'Resume experience', exact: true }).click();
      if (action === 'replay')
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
    }
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await audioResources(page)).toEqual({
      frames: 0,
      playing: 0,
      sources: 0,
      listeners: 0,
    });
    await page.route('**/audio/orbit-guide.wav', (route) => route.abort());
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
    await expect(page.locator('[data-sound-status]')).toContainText('Sound unavailable');
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('.urk-interactive-media video')
          .evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(false);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(errors).toEqual([]);
  });
}
