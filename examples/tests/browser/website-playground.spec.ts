/**
 * Company: EonHive Inc.
 * Title: Website Playground Ownership
 * Purpose: Verify public navigation, history restoration, and shared Astro host cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-08
 * Updated: 2026-10-09
 * Notes: Vibe coded with Codex.
 */

import { expect, test } from '@playwright/test';

const website = 'http://127.0.0.1:4322';

test('main navigation opens v2 and back navigation restores a fresh silent experience', async ({ page }) => {
  await page.goto(website);
  await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'Playground', exact: true }).click();
  await expect(page).toHaveURL(/\/playground\/?$/);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  const scene = page.getByRole('group', { name: 'Interactive objects' });
  const original = await scene.getAttribute('aria-describedby');
  await scene.press('3');
  await expect(page.locator('[data-card="Connect"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('slider', { name: 'Volume' }).fill('0.7');
  await page.getByRole('link', { name: 'Inspect example configs' }).click();
  await expect(page).toHaveURL(`${website}/playground/config/`);
  await expect(page.getByRole('button', { name: 'Validate config' })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(scene).not.toHaveAttribute('aria-describedby', original!);
  await expect(page.locator('[data-card="Connect"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('0.7');
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.site-header')).toHaveCSS('position', 'static');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: '../.codex/validation/playground-website-mobile.png', fullPage: true });
});

test('page restoration waits for pending audio cleanup before mounting again', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const probe = { plays: 0, release: () => {}, elements: [] as HTMLAudioElement[] };
    Object.assign(window, { websiteAudio: probe });
    window.Audio = class extends NativeAudio {
      constructor(src?: string) { super(src); probe.elements.push(this); }
      async play(): Promise<void> {
        probe.plays++;
        await new Promise<void>(resolve => { probe.release = resolve; });
        await super.play();
      }
    };
  });
  await page.goto(`${website}/playground/`);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  const scene = page.getByRole('group', { name: 'Interactive objects' });
  const original = await scene.getAttribute('aria-describedby');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).websiteAudio.plays)).toBe(1);
  // Deterministically exercise the persisted-page lifecycle even when the browser declines bfcache.
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('disposing');
  await expect(scene).toHaveAttribute('aria-describedby', original!);
  expect(await page.evaluate(() => (window as any).websiteAudio.elements[0].muted)).toBe(true);
  await page.evaluate(() => (window as any).websiteAudio.release());
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(scene).not.toHaveAttribute('aria-describedby', original!);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const probe = (window as any).websiteAudio;
    return { plays: probe.plays, oldPaused: probe.elements[0].paused, oldSource: probe.elements[0].getAttribute('src') };
  })).toEqual({ plays: 1, oldPaused: true, oldSource: '' });
});

test('v02 alias releases a disconnected host and the config inspector remains usable', async ({ page }) => {
  await page.goto(`${website}/v02/`);
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await page.evaluate(() => {
    const host = document.querySelector('urk-playground')!;
    Object.assign(window, { removedPlayground: host });
    host.remove();
  });
  await expect.poll(() => page.evaluate(() => (window as any).removedPlayground.children.length)).toBe(0);
  await page.evaluate(() => document.querySelector('#content')!.append((window as any).removedPlayground));
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(page.locator('canvas')).toHaveCount(1);
  // Repeated clicks during the same cleanup must not create competing runtimes.
  await page.evaluate(() => {
    const restart = document.querySelector<HTMLButtonElement>('[data-action="restart"]')!;
    restart.click();
    restart.click();
  });
  await expect(page.getByTestId('v02-lifecycle')).toHaveText('running');
  await expect(page.getByTestId('v02-owned')).toHaveText('1');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.goto(`${website}/playground/config/`);
  await page.getByRole('textbox', { name: 'Editable playground schema and config' }).fill('{"example":"missing"}');
  await page.getByRole('button', { name: 'Validate config' }).click();
  await expect(page.locator('[data-playground-validation]')).toContainText('Unknown or non-current example');
  await page.getByRole('button', { name: 'Reset config' }).click();
  await expect(page.locator('[data-playground-validation]')).toContainText('Config valid');
});
