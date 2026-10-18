/**
 * Company: EonHive Inc. | Title: Audio Analysis Browser Proof
 * Purpose: Verify real Web Audio data, transport controls, frame demand, and graph disposal.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';

test('one graph drives all outputs and survives bypass, source changes, and shutdown', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const probe = { contexts: 0, analysers: 0, sources: 0, closes: 0 };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor() { super(); probe.contexts++; }
      createAnalyser() { probe.analysers++; return super.createAnalyser(); }
      createMediaElementSource(element: HTMLMediaElement) { probe.sources++; return super.createMediaElementSource(element); }
      close() { probe.closes++; return super.close(); }
    };
    Object.assign(window, { audioProbe: probe });
  });
  await page.goto(`http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}/audio-proof/analysis.html`);
  await expect(page.locator('[data-audio="lifecycle"]')).toHaveText('running');
  await expect(page.locator('[data-audio="frames"]')).toHaveText('idle');
  expect(await page.evaluate(() => (window as any).audioProbe.contexts)).toBe(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-audio="status"]')).toHaveText('Audio playing.');
  await expect.poll(() => page.locator('[data-audio="level"]').evaluate((element: HTMLMeterElement) => element.value)).toBeGreaterThan(0.001);
  await expect.poll(() => page.locator('[data-audio="bass"]').evaluate((element: HTMLMeterElement) => element.value)).toBeGreaterThan(0.01);
  await expect.poll(() => page.locator('[data-audio="mids"]').evaluate((element: HTMLMeterElement) => element.value)).toBeGreaterThan(0.01);
  await expect.poll(() => page.locator('[data-audio="treble"]').evaluate((element: HTMLMeterElement) => element.value)).toBeGreaterThan(0.01);
  await expect(page.locator('[data-audio="frames"]')).toHaveText('running');
  const values = await page.locator('meter').evaluateAll(elements => elements.map(element => (element as HTMLMeterElement).value));
  expect(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
  await page.screenshot({ path: `../.codex/validation/audio-analysis-${test.info().project.name}.png`, fullPage: true });
  await page.locator('[data-audio="fft"]').selectOption('8192');
  await expect(page.locator('[data-audio="format"]')).toHaveText('8192 samples · 4096 bins');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('[data-audio="frames"]')).toHaveText('idle');
  await expect(page.locator('[data-audio="level-value"]')).toHaveText('0%');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('[data-audio="status"]')).toHaveText('Audio playing.');
  await page.locator('[data-audio="enabled"]').uncheck();
  await expect(page.locator('[data-audio="status"]')).toHaveText('Audio playing.');
  await expect(page.locator('[data-audio="frames"]')).toHaveText('idle');
  await page.locator('[data-audio="enabled"]').check();
  await expect(page.locator('[data-audio="frames"]')).toHaveText('running');
  await page.locator('[data-audio="track"]').selectOption('bed');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('[data-audio="status"]')).toHaveText('Audio playing.');
  await expect.poll(() => page.locator('[data-audio="level"]').evaluate((element: HTMLMeterElement) => element.value)).toBeGreaterThan(0.001);
  await page.getByRole('button', { name: 'Pause runtime', exact: true }).click();
  await expect(page.locator('[data-audio="frames"]')).toHaveText('idle');
  await expect(page.locator('[data-audio="lifecycle"]')).toHaveText('paused');
  await page.getByRole('button', { name: 'Shut down', exact: true }).click();
  await expect(page.locator('[data-audio="lifecycle"]')).toHaveText('disposed');
  expect(await page.evaluate(() => (window as any).audioProbe)).toEqual({ contexts: 1, analysers: 1, sources: 2, closes: 1 });
  expect(errors).toEqual([]);
});
