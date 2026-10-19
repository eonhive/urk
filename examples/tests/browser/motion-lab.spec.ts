/**
 * Company: EonHive Inc. | Title: Motion Lab Browser Proof
 * Purpose: Verify real DOM timing, navigation interruption, runtime controls, and fresh ownership.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';

const url = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}/motion-lab/`;

test('Explore preset playground applies drafts, respects lifecycle, and retains settings on restart', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#lifecycle')).toHaveText('running');
  await page.getByText('Preset playground', { exact: false }).click();
  const distance = page.locator('#preset-distance');
  await distance.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#preset-distance-value')).toHaveText('1 px');
  await page.keyboard.press('Home');
  await page.locator('#preset-duration').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.locator('#preset-stagger').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#preset-preview')).toHaveText('140 ms / pass');
  await expect(page.locator('#timeline-duration')).toHaveText('1,180 ms / pass');
  await page.locator('#preset-apply').click();
  await expect(page.locator('#timeline-duration')).toHaveText('140 ms / pass');
  await expect(page.locator('#playback')).toHaveText('completed');
  expect(
    await page.locator('.explore-item').evaluateAll((items) =>
      items.every((item) => {
        const element = item as HTMLElement;
        return (
          !element.inert &&
          element.style.opacity === '1' &&
          element.style.transform === 'translate(0px, 0px) rotate(0deg) scale(1)'
        );
      }),
    ),
  ).toBe(true);
  await page.locator('#pause').click();
  await expect(distance).toBeDisabled();
  await expect(page.locator('#preset-apply')).toBeDisabled();
  await page.locator('#resume').click();
  await expect(distance).toBeEnabled();
  await page.locator('#next').click();
  await expect(page.locator('#phase')).toHaveText('transition');
  await expect(distance).toBeDisabled();
  await expect(page.locator('#current-view')).toHaveText('create');
  await expect(page.locator('#phase')).toHaveText('ready');
  await expect(distance).toBeDisabled();
  await page.locator('#reduced').check();
  await page.locator('[data-view="explore"]').click();
  await expect(page.locator('#current-view')).toHaveText('explore');
  await expect(page.locator('#preset-apply')).toBeEnabled();
  await page.locator('#preset-apply').click();
  await expect(page.locator('#active-count')).toHaveText('0');
  await expect(page.locator('.explore-item').last()).not.toHaveAttribute('inert', '');
  await page.locator('#dispose').click();
  await expect(page.locator('#lifecycle')).toHaveText('disposed');
  await expect(distance).toBeDisabled();
  await page.locator('#restart').click();
  await expect(page.locator('#instance')).toHaveText('02');
  await expect(page.locator('#timeline-duration')).toHaveText('140 ms / pass');
  await expect(distance).toHaveValue('0');
  await page.locator('#preset-reset').click();
  await expect(distance).toHaveValue('38');
  await expect(page.locator('#timeline-duration')).toHaveText('1,180 ms / pass');
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('preset-playground.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('standalone lab navigates, freezes, cancels, and restarts after disposal', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#lifecycle')).toHaveText('running');
  await expect(page.locator('#phase')).toHaveText('ready');
  await page.locator('#replay').click();
  await expect
    .poll(async () => Number(await page.locator('#progress').getAttribute('value')))
    .toBeGreaterThan(0.05);
  await page.locator('#pause').click();
  await expect(page.locator('#lifecycle')).toHaveText('paused');
  const frozen = await page.locator('.explore-item').first().getAttribute('style');
  const progress = await page.locator('#progress').getAttribute('value');
  await page.waitForTimeout(180);
  expect(await page.locator('.explore-item').first().getAttribute('style')).toBe(frozen);
  expect(await page.locator('#progress').getAttribute('value')).toBe(progress);
  await page.locator('#resume').click();
  await expect
    .poll(async () => Number(await page.locator('#progress').getAttribute('value')))
    .toBeGreaterThan(Number(progress));
  await page.locator('#next').click();
  await expect(page.locator('#phase')).toHaveText('transition');
  await page.locator('#pause').click();
  const transitionPosition = await page.locator('#veil').getAttribute('style');
  await page.waitForTimeout(150);
  expect(await page.locator('#veil').getAttribute('style')).toBe(transitionPosition);
  await page.locator('#resume').click();
  await expect(page.locator('#current-view')).toHaveText('create');
  await expect(page.locator('#create')).toBeVisible();
  await expect(page.locator('#explore')).toHaveAttribute('inert', '');
  await page.locator('#compose').click();
  await page.locator('[data-view="connect"]').click();
  await page.locator('[data-view="explore"]').click();
  await page.locator('[data-view="connect"]').click();
  await expect(page.locator('#current-view')).toHaveText('connect');
  await expect(page.locator('#phase')).toHaveText('ready');
  await page.locator('#send-signal').click();
  await expect(page.locator('.node-a')).not.toHaveAttribute('inert', '');
  await page.locator('.node-a').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.node-a')).toBeFocused();
  await page.locator('#next').click();
  await expect(page.locator('#phase')).toHaveText('transition');
  await page.locator('#cancel').click();
  await expect(page.locator('#phase')).toHaveText('ready');
  await expect(page.locator('#current-view')).toHaveText('connect');
  await expect(page.locator('#connect')).toBeVisible();
  await page.locator('#previous').click();
  await expect(page.locator('#current-view')).toHaveText('create');
  await page.locator('#replay').click();
  await page.locator('#dispose').click();
  await expect(page.locator('#lifecycle')).toHaveText('disposed');
  await expect(page.locator('#active-count')).toHaveText('0');
  const disposed = await page.locator('.shape').first().getAttribute('style');
  await page.waitForTimeout(100);
  expect(await page.locator('.shape').first().getAttribute('style')).toBe(disposed);
  await page.locator('#restart').click();
  await expect(page.locator('#lifecycle')).toHaveText('running');
  await expect(page.locator('#instance')).toHaveText('02');
  await expect(page.locator('#current-view')).toHaveText('explore');
  await page.locator('#next').click();
  await expect(page.locator('#current-view')).toHaveText('create');
  await page.screenshot({
    path: testInfo.outputPath('motion-lab-desktop.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('reduced-motion system preference and user override preserve navigation and keyboard interaction', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.locator('#reduced')).toBeChecked();
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.locator('.sample-card').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sample-card').first()).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-view="create"]').click();
  await expect(page.locator('#current-view')).toHaveText('create');
  await expect(page.locator('#phase')).toHaveText('ready');
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.locator('#reduced').uncheck();
  await page.locator('#replay').click();
  await expect
    .poll(async () => Number(await page.locator('#active-count').textContent()))
    .toBeGreaterThan(0);
  await page.locator('#reduced').check();
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.locator('#next').click();
  await expect(page.locator('#current-view')).toHaveText('connect');
  await expect(page.locator('#phase')).toHaveText('ready');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('motion-lab-mobile.png'),
    fullPage: true,
  });
});

test('timeline scrubbing previews exact positions, pauses locally, and preserves runtime ownership', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#playback')).toHaveText('completed');
  const scrubber = page.getByLabel('Scrub sequence', { exact: true });
  await expect(scrubber).toBeEnabled();
  // A completed sequence creates a fresh paused timeline when scrubbed again.
  await scrubber.click();
  const middle = Number(await scrubber.inputValue());
  expect(middle).toBeGreaterThan(450);
  expect(middle).toBeLessThan(550);
  await expect(page.locator('#playback')).toHaveText('paused');
  await expect(page.locator('#lifecycle')).toHaveText('running');
  const preview = await page.locator('.explore-item').first().getAttribute('style');
  await page.waitForTimeout(150);
  expect(await page.locator('.explore-item').first().getAttribute('style')).toBe(preview);
  await scrubber.focus();
  await page.keyboard.press('Home');
  await expect(scrubber).toHaveValue('0');
  await expect(page.locator('#progress-label')).toHaveText('0%');
  await expect(page.locator('.explore-item').first()).toHaveAttribute('inert', '');
  expect(
    await page
      .locator('.explore-item')
      .evaluateAll((items) => items.every((item) => (item as HTMLElement).style.opacity === '0')),
  ).toBe(true);
  await page.keyboard.press('End');
  await expect(scrubber).toHaveValue('1000');
  await expect(page.locator('#playback')).toHaveText('paused');
  await expect(page.locator('#progress-label')).toHaveText('100%');
  await expect(page.locator('.explore-item').first()).not.toHaveAttribute('inert', '');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(scrubber).toHaveValue('1');
  await page.locator('#timeline-toggle').click();
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(1);
  await expect(page.locator('#playback')).toHaveText('completed');
  // Explicit seeks render while the runtime is paused without restarting its clock.
  await page.locator('#pause').click();
  await scrubber.focus();
  await page.keyboard.press('Home');
  await expect(scrubber).toHaveValue('0');
  await expect(page.locator('#lifecycle')).toHaveText('paused');
  await expect(page.locator('#timeline-toggle')).toBeDisabled();
  await page.waitForTimeout(150);
  await expect(scrubber).toHaveValue('0');
  await page.locator('#resume').click();
  await expect(page.locator('#playback')).toHaveText('paused');
  await page.locator('#timeline-toggle').click();
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(0);
  await page.locator('#next').click();
  await expect(scrubber).toBeDisabled();
  await expect(page.locator('#current-view')).toHaveText('create');
  await expect(scrubber).toBeEnabled();
  await page.locator('#reduced').check();
  await expect(scrubber).toBeDisabled();
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.locator('#dispose').click();
  await expect(page.locator('#lifecycle')).toHaveText('disposed');
  await expect(scrubber).toBeDisabled();
  await page.locator('#restart').click();
  await expect(page.locator('#lifecycle')).toHaveText('running');
  await expect(scrubber).toBeDisabled();
  await page.locator('#reduced').uncheck();
  await scrubber.focus();
  await page.keyboard.press('Home');
  await expect(scrubber).toHaveValue('0');
  await page.setViewportSize({ width: 390, height: 844 });
  await scrubber.click();
  await expect(page.locator('#playback')).toHaveText('paused');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('timeline-scrubbing.png'), fullPage: true });
  expect(errors).toEqual([]);
});
