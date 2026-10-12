/**
 * Company: EonHive Inc.
 * Title: URK Brand Experience Checks
 * Purpose: Verify responsive navigation, theme persistence, and redraw without remounting.
 * Author: Stan Nesi
 * Created: 2026-10-11
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

import { expect, test } from '@playwright/test';

const website = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;

test('homepage stays usable in both themes at desktop and phone sizes', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(website);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A tiny runtime.');
  await expect(page.locator('.home-world img')).toBeVisible();
  expect(await page.locator('.home-world img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1024);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['dark', 'light']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) {
        await page.getByRole('button', { name: `Switch to ${theme} theme` }).click();
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Playground' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open playground', exact: true })).toBeVisible();
      if (info.project.name === 'chromium') await page.screenshot({ path: info.outputPath(`home-${width}-${theme}.png`), fullPage: true });
    }
  }
  await page.getByRole('link', { name: 'Open playground', exact: true }).click();
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('theme changes redraw the existing scene and work with blocked storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage is blocked', 'SecurityError'); } });
  });
  await page.goto(`${website}/playground/`);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  const scene = page.getByRole('group', { name: 'Interactive objects', exact: true });
  await expect(page.getByText('Session only', { exact: true })).toBeVisible();
  await scene.press('2');
  await expect(scene).toHaveAttribute('data-render-pending', 'false');
  const owner = await scene.getAttribute('aria-describedby');
  const renders = Number(await scene.getAttribute('data-render-count'));
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(renders);
  await expect(scene).toHaveAttribute('aria-describedby', owner!);
  await expect(scene).toHaveAttribute('data-selected', 'Create');
  await expect(page.getByTestId('v02-frames')).toHaveText('Idle');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Show diagnostics' }).click();
  await expect(page.getByRole('button', { name: 'Hide diagnostics' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Hide diagnostics' }).click();
  await expect(page.getByTestId('v02-diagnostics')).toHaveText('Diagnostics off');
  expect(errors).toEqual([]);
});
