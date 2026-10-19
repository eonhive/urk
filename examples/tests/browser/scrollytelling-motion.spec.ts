/**
 * Company: EonHive Inc. | Title: Story Motion Browser Proof
 * Purpose: Verify real guided scrolling, manual takeover, finite entrances, and fresh runtime ownership.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';

const url = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}/scrollytelling/`;
const role = (name: string) => `[data-role="${name}"]`;

test('guided scrolling reuses motion, freezes with the runtime, and yields to newer input', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await page.locator(role('motion-source')).selectOption('playback');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  const scroll = page.locator(role('scroll-container'));
  const position = () => scroll.evaluate((element) => element.scrollTop);
  await page.locator(role('nav-proof')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('transition');
  await expect.poll(position).toBeGreaterThan(0);
  await page.locator(role('pause-button')).click();
  await expect(page.locator(role('lifecycle-value'))).toHaveText('paused');
  const frozen = await position();
  await page.waitForTimeout(180);
  expect(await position()).toBe(frozen);
  await expect(page.locator(role('motion-status-value'))).toHaveText('paused');
  await page.locator(role('resume-button')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(page.locator(role('section-value'))).toHaveText('Proof');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  const proofPosition = await position();
  await page.locator(role('replay-button')).click();
  await expect
    .poll(async () => Number(await page.locator(role('motion-value')).textContent()))
    .toBeGreaterThan(0);
  await page.locator(role('nav-intro')).click();
  await page.locator(role('nav-runtime')).click();
  // Keyboard activation tests retained focus without assuming mouse clicks focus buttons.
  await page.locator(role('nav-orchestration')).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(page.locator(role('section-value'))).toHaveText('Orchestration');
  await expect(page.locator(role('nav-orchestration'))).toBeFocused();
  await page.locator(role('nav-proof')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('transition');
  await scroll.hover();
  await page.mouse.wheel(0, 90);
  await expect(page.locator(role('action-value'))).toHaveText('Manual scrolling took over');
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  // Allow the native gesture and the finite chapter entrance to settle. Engines
  // differ in whether this first gesture also moves an actively tweened scroller.
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  const retained = await position();
  expect(retained).toBeLessThan(proofPosition - 1);
  await page.waitForTimeout(200);
  expect(Math.abs((await position()) - retained)).toBeLessThan(2);
  // Once guided motion has yielded, ordinary native scrolling must remain usable.
  const wheelDestination = await scroll.evaluate((element) =>
    Math.min(element.scrollTop + 90, element.scrollHeight - element.clientHeight),
  );
  await page.mouse.wheel(0, 90);
  await expect.poll(async () => Math.abs((await position()) - wheelDestination)).toBeLessThan(2);
  await scroll.focus();
  await page.keyboard.press('1');
  await expect(page.locator(role('section-value'))).toHaveText('Intro');
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(role('section-value'))).toHaveText('Orchestration');
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await page.locator(role('nav-proof')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('transition');
  await page.locator(role('cancel-button')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  await page.screenshot({ path: testInfo.outputPath('story-motion-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('native scroll seeks reversible poses, remeasures layout, and releases preview ownership', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  const scroll = page.locator(role('scroll-container'));
  const playhead = page.locator(role('scroll-time-value'));
  const source = page.locator(role('motion-source'));
  const cards = page.locator('.story-section__visual-card');
  const poses = () =>
    cards.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).style.transform),
    );
  const seekScroll = async (progress: number) => {
    await scroll.evaluate((element, fraction) => {
      element.scrollTop = fraction * (element.scrollHeight - element.clientHeight);
    }, progress);
    await expect(playhead).toHaveText(`${Math.round(progress * 1000)} / 1,000 ms`);
  };
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(source).toHaveValue('scroll');
  await expect(page.locator(role('replay-button'))).toBeDisabled();
  await expect(page.locator(role('motion-status-value'))).toHaveText('scroll-linked');
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  const initial = await poses();
  await scroll.focus();
  await page.keyboard.press('End');
  await expect(playhead).toHaveText('1000 / 1,000 ms');
  await page.waitForTimeout(100);
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  await page.keyboard.press('Home');
  await expect(playhead).toHaveText('0 / 1,000 ms');
  // Native keyboard scrolling can briefly round to 0ms before reaching its
  // exact endpoint. Verify the restored pose itself, without relaxing precision.
  await expect.poll(poses).toEqual(initial);
  await scroll.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(playhead).not.toHaveText('0 / 1,000 ms');
  expect(await poses()).not.toEqual(initial);
  await seekScroll(0.5);
  const middle = await poses();
  await seekScroll(0.8);
  expect(await poses()).not.toEqual(middle);
  await seekScroll(0.5);
  expect(await poses()).toEqual(middle);
  await page.waitForTimeout(150);
  expect(await poses()).toEqual(middle);

  await page.locator(role('pause-button')).click();
  await expect(source).toBeDisabled();
  await scroll.evaluate((element) => {
    element.scrollTop += 100;
  });
  await expect(playhead).toHaveText('500 / 1,000 ms');
  await page.waitForTimeout(120);
  expect(await poses()).toEqual(middle);
  await page.locator(role('resume-button')).click();
  await expect(page.locator(role('lifecycle-value'))).toHaveText('running');
  await expect(playhead).toHaveText('500 / 1,000 ms');
  await page.setViewportSize({ width: 390, height: 844 });
  // Change the playhead first so the assertion waits for a new-layout render,
  // rather than accepting the previous viewport's already-visible 500ms label.
  await seekScroll(1);
  await seekScroll(0.5);
  const narrow = await poses();
  expect(narrow).not.toEqual(middle);
  await seekScroll(1);
  await seekScroll(0.5);
  expect(await poses()).toEqual(narrow);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator(role('reduced-input'))).toBeChecked();
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  await expect(playhead).toHaveText('Static · reduced motion');
  expect(await poses()).toEqual(['none', 'none', 'none', 'none']);
  await seekScrollStatic();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(playhead).toHaveText('250 / 1,000 ms');
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  await page.locator(role('reduced-input')).check();
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  await page.locator(role('reduced-input')).uncheck();
  await expect(playhead).toHaveText('250 / 1,000 ms');
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  // A user override remains authoritative when the system preference changes.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator(role('reduced-input'))).not.toBeChecked();
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  await source.selectOption('playback');
  await expect(page.locator(role('replay-button'))).toBeEnabled();
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  await source.selectOption('scroll');
  await expect(playhead).toHaveText('250 / 1,000 ms');
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  await page.screenshot({ path: testInfo.outputPath('story-scroll-timeline.png'), fullPage: true });
  await page.locator(role('shutdown-button')).click();
  await expect(page.locator(role('lifecycle-value'))).toHaveText('disposed');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  await expect(source).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator(role('restart-button')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(source).toHaveValue('scroll');
  await expect(playhead).toHaveText('0 / 1,000 ms');
  await expect(page.locator(role('motion-value'))).toHaveText('5');
  expect(errors).toEqual([]);

  async function seekScrollStatic() {
    await scroll.evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 4;
    });
    await page.waitForTimeout(100);
    expect(await poses()).toEqual(['none', 'none', 'none', 'none']);
  }
});

test('reduced motion, native button keys, disposal, and restart work on a narrow viewport', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(page.locator(role('reduced-input'))).toBeChecked();
  await page.locator(role('nav-runtime')).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(role('section-value'))).toHaveText('Runtime');
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  await expect(page.locator(role('nav-runtime'))).toBeFocused();
  await page.locator(role('reduced-input')).uncheck();
  await page.locator(role('nav-proof')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('transition');
  await page.locator(role('shutdown-button')).click();
  await expect(page.locator(role('lifecycle-value'))).toHaveText('disposed');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  const stopped = await page
    .locator(role('scroll-container'))
    .evaluate((element) => element.scrollTop);
  await page.waitForTimeout(150);
  expect(
    await page.locator(role('scroll-container')).evaluate((element) => element.scrollTop),
  ).toBe(stopped);
  await page.keyboard.press('1');
  expect(
    await page.locator(role('scroll-container')).evaluate((element) => element.scrollTop),
  ).toBe(stopped);
  await page.locator(role('restart-button')).click();
  await expect(page.locator(role('phase-value'))).toHaveText('ready');
  await expect(page.locator(role('lifecycle-value'))).toHaveText('running');
  await expect(page.locator(role('section-value'))).toHaveText('Intro');
  await page.locator(role('nav-proof')).click();
  await expect(page.locator(role('section-value'))).toHaveText('Proof');
  await expect(page.locator(role('motion-value'))).toHaveText('0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('story-motion-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
