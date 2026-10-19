/**
 * Company: EonHive Inc. | Title: Embedded Motion Widget Browser Proof
 * Purpose: Verify independent widgets sharing runtime pause, cleanup, and fresh restart.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';

const url = `http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}/motion-widget/`;

test('portable presets import atomically, retain pauses, and work between widgets', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const firstHost = page.getByRole('region', { name: 'Signal embed host', exact: true });
  const first = firstHost.locator('.umw');
  const second = page.getByRole('region', { name: 'Studio motion widget', exact: true });
  await first.getByText('Share settings', { exact: true }).click();
  const json = first.getByLabel('Preset JSON', { exact: true });
  await first.getByRole('button', { name: 'Export JSON', exact: true }).click();
  expect(JSON.parse(await json.inputValue())).toEqual({
    version: 1,
    timing: { entranceMs: 700, staggerMs: 140, revealMs: 320 },
    playbackRate: 1,
  });
  const scrubber = first.getByLabel('Scrub sequence', { exact: true });
  await scrubber.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  const pose = await first.locator('.umw-tile').first().getAttribute('style');
  const time = await first.locator('.umw-time').textContent();
  await page.locator('#pause-runtime').click();
  await firstHost.getByLabel('Remember settings on this device', { exact: true }).check();
  const preset = {
    version: 1,
    timing: { entranceMs: 1100, staggerMs: 100, revealMs: 200 },
    playbackRate: 0.75,
  };
  await json.fill(JSON.stringify(preset));
  await first.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await expect(first.getByLabel('Playback speed', { exact: true })).toHaveValue('0.75');
  await expect(first.locator('.umw-time')).toHaveText(time!);
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(pose);
  await expect(page.locator('#runtime-state')).toHaveText('paused');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('urk:motion-widget:standalone:signal')!),
    ),
  ).toEqual(preset);
  await first.getByRole('button', { name: 'Export JSON', exact: true }).click();
  expect(JSON.parse(await json.inputValue())).toEqual(preset);

  await json.fill(
    JSON.stringify({ ...preset, playbackRate: 2, timing: { ...preset.timing, revealMs: -1 } }),
  );
  await first.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await expect(json).toHaveAttribute('aria-invalid', 'true');
  await expect(first.getByLabel('Playback speed', { exact: true })).toHaveValue('0.75');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('urk:motion-widget:standalone:signal')!),
    ),
  ).toEqual(preset);
  await first.getByRole('button', { name: 'Export JSON', exact: true }).click();
  await expect(json).toHaveAttribute('aria-invalid', 'false');
  const portable = await json.inputValue();
  await second.getByText('Share settings', { exact: true }).click();
  await second.getByLabel('Preset JSON', { exact: true }).fill(portable);
  await second.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await expect(second.getByLabel('Playback speed', { exact: true })).toHaveValue('0.75');
  await page.locator('#resume-runtime').click();
  await expect(first.locator('.umw-status')).toHaveText('paused');
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(first.locator('.umw-time')).toContainText('/ 1,500 ms');
  await expect(first.locator('.umw-status')).toHaveText('completed');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await first.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.locator('#dispose-runtime').click();
  await expect(page.locator('.umw')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('widget settings persist only after opt-in and forget without changing playback', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const firstHost = page.getByRole('region', { name: 'Signal embed host', exact: true });
  const secondHost = page.getByRole('region', { name: 'Studio embed host', exact: true });
  const remember = firstHost.getByLabel('Remember settings on this device', { exact: true });
  const first = firstHost.locator('.umw');
  const speed = first.getByLabel('Playback speed', { exact: true });
  const key = 'urk:motion-widget:standalone:signal';
  const saved = () => page.evaluate((key) => localStorage.getItem(key), key);
  await expect(remember).not.toBeChecked();
  await speed.selectOption('2');
  expect(await saved()).toBeNull();
  await remember.check();
  await expect.poll(saved).not.toBeNull();
  await first.getByText('Timing settings', { exact: true }).click();
  await first.getByLabel('Entrance (ms)', { exact: true }).fill('1200');
  expect(JSON.parse((await saved())!).timing.entranceMs).toBe(700);
  await first.getByRole('button', { name: 'Apply & replay', exact: true }).click();
  expect(JSON.parse((await saved())!).timing.entranceMs).toBe(1200);
  await expect(
    secondHost.getByLabel('Remember settings on this device', { exact: true }),
  ).not.toBeChecked();
  await expect(secondHost.getByLabel('Playback speed', { exact: true })).toHaveValue('1');

  await page.locator('#toggle-0').click();
  await page.locator('#toggle-0').click();
  await expect(speed).toHaveValue('2');
  await page.locator('#dispose-runtime').click();
  await expect(page.locator('.umw-preferences')).toHaveCount(0);
  await page.locator('#restart-runtime').click();
  await expect(page.locator('#instance')).toHaveText('02');
  await expect(speed).toHaveValue('2');
  await expect(remember).toBeChecked();
  await first.getByText('Timing settings', { exact: true }).click();
  await expect(first.getByLabel('Entrance (ms)', { exact: true })).toHaveValue('1200');
  await page.reload();
  await expect(page.locator('#runtime-state')).toHaveText('running');
  await expect(speed).toHaveValue('2');
  await expect(remember).toBeChecked();

  const scrubber = first.getByLabel('Scrub sequence', { exact: true });
  await scrubber.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  const pose = await first.locator('.umw-tile').first().getAttribute('style');
  await remember.uncheck();
  expect(await saved()).toBeNull();
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(pose);
  await expect(speed).toHaveValue('2');
  await page.reload();
  await expect(speed).toHaveValue('1');
  await expect(remember).not.toBeChecked();

  await page.evaluate((key) => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await expect(speed).toHaveValue('1');
  await expect(firstHost.locator('.umw-preferences [role="status"]')).toContainText('invalid');
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked');
      },
    }),
  );
  await page.reload();
  await expect(page.locator('#runtime-state')).toHaveText('running');
  await expect(remember).toBeDisabled();
  await expect(firstHost.locator('.umw-preferences [role="status"]')).toContainText(
    'Storage unavailable',
  );
  await speed.selectOption('0.5');
  await expect(speed).toHaveValue('0.5');
  expect(errors).toEqual([]);
});

test('widget scrubbing previews keyboard endpoints and preserves playback ownership', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const first = page.getByRole('region', { name: 'Signal motion widget', exact: true });
  const scrubber = first.getByLabel('Scrub sequence', { exact: true });
  await expect(first.locator('.umw-status')).toHaveText('completed');
  await first.getByLabel('Playback speed', { exact: true }).selectOption('2');
  await scrubber.focus();
  await page.keyboard.press('Home');
  await expect(scrubber).toHaveValue('0');
  await expect(first.locator('.umw-status')).toHaveText('paused');
  await expect(first.locator('.umw-time')).toHaveText('0 / 1,300 ms');
  expect(
    await first
      .locator('.umw-tile')
      .evaluateAll((elements) =>
        elements.every((element) => (element as HTMLElement).style.opacity === '0'),
      ),
  ).toBe(true);
  await page.keyboard.press('End');
  await expect(scrubber).toHaveValue('1000');
  await expect(first.locator('.umw-result')).toHaveCSS('opacity', '1');
  await expect(first.locator('.umw-status')).toHaveText('paused');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(scrubber).toHaveValue('1');
  await expect(scrubber).toHaveAttribute('aria-valuetext', '1 of 1,300 milliseconds');
  await scrubber.click();
  const middle = Number(await scrubber.inputValue());
  expect(middle).toBeGreaterThan(450);
  expect(middle).toBeLessThan(550);
  const pose = await first.locator('.umw-tile').first().getAttribute('style');
  const time = await first.locator('.umw-time').textContent();
  await page.waitForTimeout(100);
  expect(await first.locator('.umw-time').textContent()).toBe(time);
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(pose);

  await page.locator('#pause-runtime').click();
  await expect(scrubber).toBeEnabled();
  await scrubber.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(first.locator('.umw-time')).toHaveText('1 / 1,300 ms');
  await expect(page.locator('#runtime-state')).toHaveText('paused');
  await page.locator('#resume-runtime').click();
  await first.scrollIntoViewIfNeeded();
  await expect(first.locator('.umw-status')).toHaveText('paused');
  await first.getByRole('button', { name: 'Resume sequence', exact: true }).click();
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(1);
  await expect(first.getByLabel('Playback speed', { exact: true })).toHaveValue('2');
  await first.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(first.locator('.umw-status')).toHaveText('cancelled');
  await scrubber.focus();
  await page.keyboard.press('Home');
  await expect(first.locator('.umw-status')).toHaveText('paused');

  await page.locator('#reduced').check();
  await expect(scrubber).toBeDisabled();
  await expect(first.locator('.umw-status')).toHaveText('completed');
  await page.locator('#reduced').uncheck();
  await expect(scrubber).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The host override remains full motion until the checkbox changes it.
  await expect(scrubber).toBeEnabled();
  await page.locator('#reduced').check();
  await expect(scrubber).toBeDisabled();
  await page.locator('#reduced').uncheck();
  await expect(scrubber).toBeEnabled();

  await first.getByText('Timing settings', { exact: true }).click();
  for (const name of ['Entrance (ms)', 'Stagger (ms)', 'Final reveal (ms)'])
    await first.getByLabel(name, { exact: true }).fill('0');
  await first.getByRole('button', { name: 'Apply & replay', exact: true }).click();
  await expect(first.locator('.umw-status')).toHaveText('completed');
  await expect(scrubber).toBeDisabled();
  await page.locator('#toggle-0').click();
  await page.locator('#toggle-0').click();
  await expect(scrubber).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await scrubber.click();
  await expect(first.locator('.umw-status')).toHaveText('paused');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('widget-scrubbing.png'), fullPage: true });
  await page.locator('#dispose-runtime').click();
  await expect(page.locator('.umw')).toHaveCount(0);
  await expect(page.locator('#active-count')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('widget playback speed is independent and preserves pose and pause ownership', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const first = page.getByRole('region', { name: 'Signal motion widget', exact: true });
  const second = page.getByRole('region', { name: 'Studio motion widget', exact: true });
  const firstSpeed = first.getByLabel('Playback speed', { exact: true });
  const secondSpeed = second.getByLabel('Playback speed', { exact: true });
  await firstSpeed.selectOption('2');
  await secondSpeed.selectOption('0.5');
  await page.locator('#replay-widgets').click();
  await first.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await second.locator('progress').getAttribute('value')))
    .toBeGreaterThan(0.02);
  const rates = await page
    .locator('.umw progress')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLProgressElement).value));
  expect(rates[0]!).toBeGreaterThan(rates[1]! * 3);
  await expect(first.locator('.umw-time')).toContainText('/ 1,300 ms');
  await expect(second.locator('.umw-time')).toContainText('/ 1,300 ms');

  await first.getByRole('button', { name: 'Pause sequence', exact: true }).click();
  const pose = await first.locator('.umw-tile').first().getAttribute('style');
  const time = await first.locator('.umw-time').textContent();
  await firstSpeed.selectOption('0.5');
  await expect(first.locator('.umw-status')).toHaveText('paused');
  await page.waitForTimeout(75);
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(pose);
  expect(await first.locator('.umw-time').textContent()).toBe(time);
  await expect(secondSpeed).toHaveValue('0.5');

  await page.locator('#pause-runtime').click();
  const secondTime = await second.locator('progress').getAttribute('value');
  await expect(firstSpeed).toBeEnabled();
  await firstSpeed.selectOption('2');
  await page.waitForTimeout(75);
  expect(await first.locator('.umw-time').textContent()).toBe(time);
  expect(await second.locator('progress').getAttribute('value')).toBe(secondTime);
  await expect(page.locator('#runtime-state')).toHaveText('paused');
  await page.locator('#resume-runtime').click();
  await first.scrollIntoViewIfNeeded();
  await expect(first.locator('.umw-status')).toHaveText('paused');
  await first.getByRole('button', { name: 'Resume sequence', exact: true }).click();
  await expect.poll(async () => first.locator('.umw-time').textContent()).not.toBe(time);
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(firstSpeed).toHaveValue('2');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(first.locator('.umw-time')).toHaveText('1,300 / 1,300 ms');
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.locator('#toggle-0').click();
  await page.locator('#toggle-0').click();
  await expect(first.getByLabel('Playback speed', { exact: true })).toHaveValue('1');
  await expect(secondSpeed).toHaveValue('0.5');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('widget-speed.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('widget timing drafts apply independently, reject invalid input, and support zero duration', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const first = page.getByRole('region', { name: 'Signal motion widget', exact: true });
  const second = page.getByRole('region', { name: 'Studio motion widget', exact: true });
  const entrance = first.getByLabel('Entrance (ms)', { exact: true });
  const stagger = first.getByLabel('Stagger (ms)', { exact: true });
  const reveal = first.getByLabel('Final reveal (ms)', { exact: true });
  await first.getByText('Timing settings', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await first.getByRole('button', { name: 'Pause sequence', exact: true }).click();
  const pausedPose = await first.locator('.umw-tile').first().getAttribute('style');
  const pausedTime = await first.locator('.umw-time').textContent();
  await entrance.fill('600');
  await stagger.fill('200');
  await reveal.fill('400');
  await expect(first.locator('.umw-draft-duration')).toHaveText('1,400 ms');
  expect(await first.locator('.umw-time').textContent()).toBe(pausedTime);
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(pausedPose);
  await stagger.fill('-1');
  await first.getByRole('button', { name: 'Apply & replay', exact: true }).click();
  expect(await stagger.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
    true,
  );
  await expect(first.locator('.umw-status')).toHaveText('paused');
  expect(await first.locator('.umw-time').textContent()).toBe(pausedTime);
  await stagger.fill('200');
  await first.getByRole('button', { name: 'Apply & replay', exact: true }).click();
  await expect(first.locator('.umw-time')).toContainText('/ 1,400 ms');
  await expect(second.locator('.umw-time')).toContainText('/ 1,300 ms');
  await first.getByRole('button', { name: 'Pause sequence', exact: true }).click();
  await entrance.fill('0');
  await stagger.fill('0');
  await reveal.fill('0');
  await first.getByRole('button', { name: 'Apply & replay', exact: true }).click();
  await expect(first.locator('.umw-status')).toHaveText('completed');
  await expect(first.locator('.umw-time')).toHaveText('0 / 0 ms');
  expect(
    await first
      .locator('.umw-tile')
      .evaluateAll((elements) =>
        elements.every(
          (element) =>
            (element as HTMLElement).style.opacity === '1' &&
            (element as HTMLElement).style.transform ===
              'translate(0px, 0px) rotate(0deg) scale(1)',
        ),
      ),
  ).toBe(true);
  await expect(first.locator('.umw-result')).toHaveCSS('opacity', '1');
  await first.getByRole('button', { name: 'Reset timing', exact: true }).click();
  await expect(entrance).toHaveValue('700');
  await expect(stagger).toHaveValue('140');
  await expect(reveal).toHaveValue('320');
  await expect(first.locator('.umw-time')).toContainText('/ 1,300 ms');
  await page.locator('#pause-runtime').click();
  await expect(entrance).toBeDisabled();
  await expect(first.getByRole('button', { name: 'Apply & replay', exact: true })).toBeDisabled();
  await page.locator('#resume-runtime').click();
  await expect(entrance).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await entrance.fill('200');
  await stagger.fill('20');
  await reveal.fill('100');
  await first.getByRole('button', { name: 'Apply & replay', exact: true }).click();
  await expect(first.locator('.umw-time')).toHaveText('340 / 340 ms');
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.locator('#toggle-0').click();
  await expect(first).toHaveCount(0);
  await page.locator('#toggle-0').click();
  await expect(first.locator('.umw-time')).toContainText('/ 1,300 ms');
  await page.setViewportSize({ width: 390, height: 844 });
  await first.getByText('Timing settings', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('widget-timing.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('embedded widgets retain independent playback and clean ownership on one runtime', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const first = page.getByRole('region', { name: 'Signal motion widget', exact: true });
  const second = page.getByRole('region', { name: 'Studio motion widget', exact: true });
  const firstProgress = first.locator('progress');
  const secondProgress = second.locator('progress');
  await page
    .locator('#widget-b .host-note')
    .evaluate((element) => element.setAttribute('data-preserved', 'yes'));
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await second.getByRole('button', { name: 'Replay', exact: true }).click();
  await first.getByRole('button', { name: 'Pause sequence', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(first.locator('.umw-status')).toHaveText('paused');
  const frozenFirst = await first.locator('.umw-tile').first().getAttribute('style');
  const firstTime = await firstProgress.getAttribute('value');
  const secondTime = Number(await secondProgress.getAttribute('value'));
  await expect
    .poll(async () => Number(await secondProgress.getAttribute('value')))
    .toBeGreaterThan(secondTime);
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(frozenFirst);
  expect(await firstProgress.getAttribute('value')).toBe(firstTime);

  await page.locator('#pause-runtime').click();
  await expect(page.locator('#runtime-state')).toHaveText('paused');
  const frozenSecond = await second.locator('.umw-tile').first().getAttribute('style');
  const pausedTime = await secondProgress.getAttribute('value');
  await page.waitForTimeout(100);
  expect(await second.locator('.umw-tile').first().getAttribute('style')).toBe(frozenSecond);
  expect(await secondProgress.getAttribute('value')).toBe(pausedTime);
  await page.locator('#resume-runtime').click();
  // Runtime controls can scroll the widgets out of view; bring them back to resume.
  await second.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await secondProgress.getAttribute('value')))
    .toBeGreaterThan(Number(pausedTime));
  await expect(first.locator('.umw-status')).toHaveText('paused');

  const removed = await second.elementHandle();
  await page.locator('#toggle-1').click();
  await expect(second).toHaveCount(0);
  await expect(page.locator('#widget-b .host-note')).toHaveAttribute('data-preserved', 'yes');
  const removedPose = await removed!.evaluate((element) =>
    element.querySelector('.umw-tile')!.getAttribute('style'),
  );
  // Detached controls must have no live listeners, even if a host retains the old root.
  await removed!.evaluate((element) =>
    element.querySelector<HTMLButtonElement>('[data-action="replay"]')!.click(),
  );
  await first.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(first.locator('.umw-status')).toHaveText('cancelled');
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(frozenFirst);
  await expect(page.locator('#active-count')).toHaveText('0');
  expect(
    await removed!.evaluate((element) => element.querySelector('.umw-tile')!.getAttribute('style')),
  ).toBe(removedPose);
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await page.locator('#toggle-1').click();
  await expect(second).toHaveCount(1);
  await expect(first.locator('.umw-status')).not.toHaveText('cancelled');

  await page.locator('#reduced').check();
  await expect(first.locator('.umw-status')).toHaveText('completed');
  await expect(second.locator('.umw-status')).toHaveText('completed');
  await expect(page.locator('#active-count')).toHaveText('0');
  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(first.locator('.umw-result')).toHaveCSS('opacity', '1');
  await page.locator('#dispose-runtime').click();
  await expect(page.locator('#runtime-state')).toHaveText('disposed');
  await expect(page.locator('.umw')).toHaveCount(0);
  await expect(page.locator('#widget-b .host-note')).toHaveAttribute('data-preserved', 'yes');
  await page.locator('#restart-runtime').click();
  await expect(page.locator('#runtime-state')).toHaveText('running');
  await expect(page.locator('#instance')).toHaveText('02');
  await expect(page.locator('.umw')).toHaveCount(2);
  await expect(page.locator('#active-count')).toHaveText('0');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('embedded-widgets.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('offscreen widgets retain position without overriding user or runtime pauses', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await expect(page.locator('#runtime-state')).toHaveText('running');
  const first = page.getByRole('region', { name: 'Signal motion widget', exact: true });
  const second = page.getByRole('region', { name: 'Studio motion widget', exact: true });
  const firstProgress = first.locator('progress');
  const secondProgress = second.locator('progress');
  const top = () => page.evaluate(() => window.scrollTo(0, 0));
  const showSecond = () => second.evaluate((element) => element.scrollIntoView({ block: 'start' }));

  await page.locator('#replay-widgets').click();
  await expect(second).toHaveAttribute('data-offscreen', 'true');
  await expect(second.locator('.umw-status')).toHaveText('offscreen');
  await page.waitForTimeout(100);
  await expect(secondProgress).toHaveAttribute('value', '0');
  await showSecond();
  await expect
    .poll(async () => Number(await secondProgress.getAttribute('value')))
    .toBeGreaterThan(0);
  await top();
  await expect(second).toHaveAttribute('data-offscreen', 'true');
  const secondTime = await secondProgress.getAttribute('value');
  const secondPose = await second.locator('.umw-tile').first().getAttribute('style');
  await page.waitForTimeout(100);
  expect(await secondProgress.getAttribute('value')).toBe(secondTime);
  expect(await second.locator('.umw-tile').first().getAttribute('style')).toBe(secondPose);
  await showSecond();
  await expect
    .poll(async () => Number(await secondProgress.getAttribute('value')))
    .toBeGreaterThan(Number(secondTime));

  await first.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect
    .poll(async () => Number(await firstProgress.getAttribute('value')))
    .toBeGreaterThan(0);
  await first.getByRole('button', { name: 'Pause sequence', exact: true }).click();
  const firstTime = await firstProgress.getAttribute('value');
  const firstPose = await first.locator('.umw-tile').first().getAttribute('style');
  await showSecond();
  await expect(first).toHaveAttribute('data-offscreen', 'true');
  await top();
  await expect(first).toHaveAttribute('data-offscreen', 'false');
  await expect(first.locator('.umw-status')).toHaveText('paused');
  expect(await firstProgress.getAttribute('value')).toBe(firstTime);
  expect(await first.locator('.umw-tile').first().getAttribute('style')).toBe(firstPose);
  await first.getByRole('button', { name: 'Resume sequence', exact: true }).click();
  await expect
    .poll(async () => Number(await firstProgress.getAttribute('value')))
    .toBeGreaterThan(Number(firstTime));

  await page.locator('#pause-runtime').click();
  await top();
  await expect(first).toHaveAttribute('data-offscreen', 'false');
  await expect(first.locator('.umw-status')).toHaveText('paused');
  const runtimeTime = await firstProgress.getAttribute('value');
  await page.waitForTimeout(100);
  expect(await firstProgress.getAttribute('value')).toBe(runtimeTime);
  await page.locator('#resume-runtime').click();
  await top();
  await expect
    .poll(async () => Number(await firstProgress.getAttribute('value')))
    .toBeGreaterThan(Number(runtimeTime));

  await page.locator('#replay-widgets').click();
  await expect(second).toHaveAttribute('data-offscreen', 'true');
  // The system preference can finish held work without scrolling it into view.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(second).toHaveAttribute('data-offscreen', 'true');
  await expect(second.locator('.umw-status')).toHaveText('completed');
  await expect(secondProgress).toHaveAttribute('value', '1');
  await expect(page.locator('#active-count')).toHaveText('0');
  const removed = await first.elementHandle();
  await page.locator('#dispose-runtime').click();
  await expect(page.locator('.umw')).toHaveCount(0);
  const detachedState = await removed!.getAttribute('data-offscreen');
  await page.locator('#restart-runtime').click();
  await expect(page.locator('#instance')).toHaveText('02');
  await top();
  await expect(first).toHaveAttribute('data-offscreen', 'false');
  expect(await removed!.getAttribute('data-offscreen')).toBe(detachedState);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('visibility-suspension.png'), fullPage: true });
  expect(errors).toEqual([]);
});
