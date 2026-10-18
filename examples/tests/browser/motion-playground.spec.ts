/**
 * Company: EonHive Inc. | Title: Numeric Motion Browser Proof
 * Purpose: Verify runtime suspension, idle frames, reduced motion, and fresh ownership.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';

test('numeric playback pauses with the runtime and releases frames on completion and disposal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${process.env.URK_PROOF_PORT ?? '5174'}/motion-playground/`);
  await expect(page.locator('#lifecycle')).toHaveText('running');
  await expect(page.locator('#frames')).toHaveText('idle');
  await page.locator('#right').click();
  await expect.poll(async () => Number(await page.locator('#position').textContent())).toBeGreaterThan(0.1);
  await page.locator('#pause-runtime').click();
  const paused = await page.locator('#position').textContent();
  await page.waitForTimeout(150);
  await expect(page.locator('#position')).toHaveText(paused!);
  await expect(page.locator('#frames')).toHaveText('idle');
  await page.locator('#finish').click();
  await expect(page.locator('#position')).toHaveText('1.400');
  await page.locator('#pause-runtime').click();
  await expect(page.locator('#active')).toHaveText('0');
  await page.locator('#left').click();
  await page.locator('#dispose-owner').click();
  await expect(page.locator('#active')).toHaveText('0');
  await expect(page.locator('#frames')).toHaveText('idle');
  await page.locator('#new-owner').click();
  await page.locator('#right').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#position')).toHaveText('1.400');
  await expect(page.locator('#active')).toHaveText('0');
  await expect(page.locator('#frames')).toHaveText('idle');
  await page.locator('#left').click();
  await expect(page.locator('#position')).toHaveText('-1.400');
  await page.locator('#destroy').click();
  await expect(page.locator('#lifecycle')).toHaveText('disposed');
  await page.locator('#fresh').click();
  await expect(page.locator('#lifecycle')).toHaveText('running');
  await expect(page.locator('#position')).toHaveText('0.000');
  expect(errors).toEqual([]);
});
