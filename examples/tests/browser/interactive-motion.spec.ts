/**
 * Company: EonHive Inc. | Title: Interactive Motion and Flow Integration
 * Purpose: Verify real native animation ownership, interrupted handoffs, focus, and reduced motion in both hosts.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Page } from '@playwright/test';
import { observeMedia, resources } from './media-probe';

async function observeMotion(page: Page) {
  await observeMedia(page);
  await page.addInitScript(() => {
    const probe = { animations: [] as Animation[], holdExit: false };
    Object.assign(window, { motionProbe: probe });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.closest('.urk-interactive-media')) {
        probe.animations.push(animation);
        const exit = Array.isArray(frames) && frames.at(-1)?.opacity === 0;
        if (probe.holdExit && this.hasAttribute('data-film') && exit) animation.pause();
      }
      return animation;
    };
  });
}
const activeAnimations = (page: Page) =>
  page.evaluate(
    () =>
      (window as any).motionProbe.animations.filter(
        (animation: Animation) => animation.playState !== 'idle',
      ).length,
  );
async function reachEnding(page: Page) {
  await page.getByLabel('Playback position', { exact: true }).fill('7.8');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-cue]')).toHaveText('Media ended / Journey complete');
}
const proof = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}`;
const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;
for (const [name, url] of [
  ['standalone', `${proof}/interactive-media/`],
  ['website', `${website}/examples/interactive-media/`],
]) {
  test(`${name}: chapter motion pauses, resumes, replaces older motion, and leaves no effects`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeMotion(page);
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect(page.locator('[data-chapter="2"]')).toBeEnabled();
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-chapter="2"]')!.click();
      document.querySelector<HTMLButtonElement>('[data-suspend]')!.click();
    });
    await expect(page.locator('[data-lifecycle]')).toHaveText('paused');
    const paused = await page.evaluate(async () => {
      const animation = (window as any).motionProbe.animations.at(-1) as Animation;
      await animation.ready;
      const time = animation.currentTime;
      await new Promise((resolve) => setTimeout(resolve, 120));
      return { state: animation.playState, sameTime: animation.currentTime === time };
    });
    expect(paused).toEqual({ state: 'paused', sameTime: true });
    await page.getByRole('button', { name: 'Resume experience' }).click();
    await expect.poll(() => activeAnimations(page)).toBe(0);
    await page.evaluate(() => {
      for (const chapter of ['0', '5', '2'])
        document.querySelector<HTMLButtonElement>(`[data-chapter="${chapter}"]`)!.click();
    });
    await expect(page.locator('[data-title]')).toContainText('out there');
    await expect.poll(() => activeAnimations(page)).toBe(0);
    expect((await resources(page)).frames).toBe(0);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await activeAnimations(page)).toBe(0);
    expect(await resources(page)).toEqual({
      urls: 0,
      frames: 0,
      playing: 0,
      sources: 0,
      listeners: 0,
    });
    expect(errors).toEqual([]);
  });

  test(`${name}: ending handoffs cancel on replay and disposal; return restores focus without autoplay`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeMotion(page);
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      (window as any).motionProbe.holdExit = true;
    });
    await reachEnding(page);
    await expect(page.locator('.media-screen')).toHaveAttribute('data-transition', 'ending');
    await page.getByRole('button', { name: 'Pause experience', exact: true }).click();
    await expect.poll(() => activeAnimations(page)).toBe(0);
    await expect(page.locator('.media-screen')).toHaveAttribute('data-scene', 'film');
    await page.getByRole('button', { name: 'Resume experience', exact: true }).click();
    await expect(page.locator('.media-screen')).toHaveAttribute('data-transition', 'ending');
    await page.getByRole('button', { name: 'Replay', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect.poll(() => activeAnimations(page)).toBe(0);
    await expect(page.locator('[data-ending]')).toBeHidden();
    await expect(page.locator('.media-screen')).toHaveAttribute('data-scene', 'film');
    await page.evaluate(() => {
      (window as any).motionProbe.holdExit = false;
    });
    await reachEnding(page);
    await expect(page.locator('[data-ending]')).toBeVisible();
    await expect.poll(() => activeAnimations(page)).toBe(0);
    expect((await resources(page)).frames).toBe(0);
    if (info.project.name === 'chromium') {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.screenshot({
        path: info.outputPath(`${name}-ending-desktop.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const bounds = await page.locator('[data-return]').boundingBox();
      const screen = await page.locator('.media-screen').boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(screen!.y + screen!.height);
      await page.screenshot({ path: info.outputPath(`${name}-ending-mobile.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Return to film', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-film]')).toBeFocused();
    await expect.poll(() => activeAnimations(page)).toBe(0);
    expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(
      true,
    );
    await page.evaluate(() => {
      (window as any).motionProbe.holdExit = true;
    });
    await reachEnding(page);
    await expect(page.locator('.media-screen')).toHaveAttribute('data-transition', 'ending');
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    expect(await activeAnimations(page)).toBe(0);
    expect(await resources(page)).toEqual({
      urls: 0,
      frames: 0,
      playing: 0,
      sources: 0,
      listeners: 0,
    });
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-lifecycle]')).toHaveText('running');
    await expect(page.locator('[data-ending]')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test(`${name}: live reduced-motion changes finish effects; reduced or unavailable animation preserves navigation`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observeMotion(page);
    await page.goto(url);
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-chapter="2"]')).toBeEnabled();
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('[data-chapter="2"]')!.click();
      document.querySelector<HTMLButtonElement>('[data-suspend]')!.click();
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => activeAnimations(page)).toBe(0);
    await page.getByRole('button', { name: 'Resume experience' }).click();
    const count = await page.evaluate(() => (window as any).motionProbe.animations.length);
    await reachEnding(page);
    await expect(page.locator('[data-ending]')).toBeVisible();
    expect(await page.evaluate(() => (window as any).motionProbe.animations.length)).toBe(count);
    await page.getByRole('button', { name: 'Watch again ↗', exact: true }).click();
    await expect(page.locator('[data-film]')).toBeVisible();
    await expect
      .poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.paused))
      .toBe(false);
    await page.getByRole('button', { name: 'Dispose', exact: true }).click();
    await expect(page.locator('[data-lifecycle]')).toHaveText('disposed');
    await page.evaluate(() => {
      Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: undefined });
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
    await page.locator('.media-layout').scrollIntoViewIfNeeded();
    await reachEnding(page);
    await expect(page.locator('[data-ending]')).toBeVisible();
    await page.getByRole('button', { name: 'Return to film', exact: true }).click();
    await expect(page.locator('[data-film]')).toBeFocused();
    expect(await activeAnimations(page)).toBe(0);
    expect(errors).toEqual([]);
  });
}
