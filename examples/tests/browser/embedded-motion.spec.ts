/**
 * Company: EonHive Inc. | Title: Website Embedded Motion Proof
 * Purpose: Check borrowed runtime playback, cleanup, and restart across website hosts.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';

const origin = `http://127.0.0.1:${process.env.URK_WEBSITE_PORT ?? '4322'}`;

test('website and MDX islands reuse the widget and preserve host lifecycle ownership', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${origin}/examples/embedded-docs-demo/`);
  const host = page.locator('[data-urk-example-root][data-example-id="embedded-docs-demo"]');
  await host.scrollIntoViewIfNeeded();
  const phase = host.locator('[data-role="runtime-phase"]');
  await expect(phase).toHaveText('ready');
  const remember = host.getByLabel('Remember settings on this device', { exact: true });
  await expect(remember).not.toBeChecked();
  await remember.check();
  await expect(host.locator('[data-role="runtime-adapters"]')).toHaveText('2');
  const widget = host.getByRole('region', { name: 'Docs signal motion widget', exact: true });
  await widget.scrollIntoViewIfNeeded();
  await expect(widget).toHaveCSS('background-color', 'rgb(16, 23, 37)');
  const scrubber = widget.getByLabel('Scrub sequence', { exact: true });
  await expect(scrubber).toBeEnabled();
  await scrubber.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(widget.locator('.umw-time')).toHaveText('1 / 1,300 ms');
  await widget.getByLabel('Playback speed', { exact: true }).selectOption('0.5');
  await widget.getByRole('button', { name: 'Resume sequence', exact: true }).click();
  await expect.poll(async () => Number(await scrubber.inputValue())).toBeGreaterThan(1);
  await host.locator('[data-role="pause-button"]').click();
  await expect(phase).toHaveText('paused');
  const frame = await host.locator('[data-role="runtime-frame"]').textContent();
  const pose = await widget.locator('.umw-tile').first().getAttribute('style');
  await page.waitForTimeout(100);
  expect(await host.locator('[data-role="runtime-frame"]').textContent()).toBe(frame);
  expect(await widget.locator('.umw-tile').first().getAttribute('style')).toBe(pose);
  await host.locator('[data-role="resume-button"]').click();
  await widget.scrollIntoViewIfNeeded();
  await expect(phase).toHaveText('ready');
  await expect(widget.locator('.umw-status')).toHaveText('completed');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scrubber).toBeDisabled();
  await widget.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(widget.locator('.umw-status')).toHaveText('completed');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await host.locator('[data-role="shutdown-button"]').click();
  await expect(host.locator('[data-role="runtime-scheduler"]')).toHaveText('Stopped');
  await expect(host.locator('[data-role="shutdown-button"]')).toBeDisabled();
  await expect(widget).toHaveCount(0);
  await expect(host.locator('.embedded-docs-demo__static')).toBeVisible();
  await host.getByRole('button', { name: 'Reset and restart Embedded Docs Demo' }).click();
  await expect(phase).toHaveText('ready');
  await expect(widget).toHaveCount(1);
  await expect(host.locator('.embedded-docs-demo')).toHaveCount(1);
  await expect(widget.getByLabel('Playback speed', { exact: true })).toHaveValue('0.5');
  await expect(remember).toBeChecked();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/docs/guides/astro-docs-embed/`);
  await host.scrollIntoViewIfNeeded();
  await expect(phase).toHaveText('ready');
  await expect(remember).toBeChecked();
  await expect(widget.getByLabel('Playback speed', { exact: true })).toHaveValue('0.5');
  await widget.scrollIntoViewIfNeeded();
  await expect(widget).toHaveCSS('background-color', 'rgb(16, 23, 37)');
  await scrubber.focus();
  await page.keyboard.press('End');
  await expect(widget.locator('.umw-time')).toHaveText('1,300 / 1,300 ms');
  await remember.uncheck();
  expect(await widget.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await widget.screenshot({ path: testInfo.outputPath('docs-widget-mobile.png') });
  await host.locator('[data-role="shutdown-button"]').click();
  await expect(widget).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
