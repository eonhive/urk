/**
 * Company: EonHive Inc. | Title: Portable Player Browser Proof
 * Purpose: Verify compiled exports, isolated iframe hosting, controls, input, media, and cleanup.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Frame, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servePlayerDemo } from '../../../scripts/serve-player-demo.mjs';
import { observeMedia } from './media-probe';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
let temporary: string;
let demo: Awaited<ReturnType<typeof servePlayerDemo>>;

test.beforeAll(async () => {
  test.setTimeout(60000);
  await mkdir(join(repo, '.codex/validation'), { recursive: true });
  temporary = await mkdtemp(join(repo, '.codex/validation/player-static-'));
  const cli = (...args: string[]) => execFileSync(process.execPath, [join(repo, 'packages/cli/dist/index.js'), ...args], {
    cwd: repo, encoding: 'utf8', timeout: 60000,
  });
  cli('export', 'examples/picking', '--out-dir', join(temporary, 'export'));
  cli('pack', join(temporary, 'export'), '--out', join(temporary, 'picking.urkpkg'), '--name', 'Picking', '--type', 'game');
  expect(cli('inspect', join(temporary, 'picking.urkpkg'))).toContain('name: Picking');
  cli('unpack', join(temporary, 'picking.urkpkg'), '--out-dir', join(temporary, 'picking'));
  cli('export', 'examples/audio-proof', '--out-dir', join(temporary, 'audio-proof'));
  demo = await servePlayerDemo({
    pickingDirectory: join(temporary, 'picking'), hostPort: 0, experiencePort: 0,
    hostMounts: [{ prefix: '/generated/', directory: join(temporary, 'embed') }],
    extraMounts: [
      { prefix: '/audio-proof/', directory: join(temporary, 'audio-proof') },
      // The unchanged Audio proof uses ../audio/; preserve that static layout.
      { prefix: '/audio/', directory: join(repo, 'examples/public/audio') },
    ],
  });
  cli('embed', `${demo.experienceOrigin}/picking/?first=1&second=2#scene`,
    '--out-dir', join(temporary, 'embed'), '--title', 'Picking <test> & "friends"', '--height', '640px', '--fullscreen');
});

test.afterAll(async () => {
  if (demo) await demo.close();
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

async function ready(page: Page, id = 'one'): Promise<Frame> {
  // Browsers throttle offscreen cross-origin frames, including the second Player on phones.
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await expect(page.locator(`#${id}`)).toHaveAttribute('data-state', 'loaded');
  const frame = (await (await page.locator(`#${id} iframe`).elementHandle())!.contentFrame())!;
  await expect(frame.locator('[data-role="phase-value"]')).toHaveText('ready');
  return frame;
}

async function select(page: Page, frame: Frame, touch = false) {
  const target = frame.locator('[data-role="scene-target-a"]');
  await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
  const box = (await target.boundingBox())!;
  // The target pulses continuously; use native input at its current position.
  if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(target).toHaveAttribute('data-selected', 'true');
}

function observe(page: Page) {
  const errors: string[] = [];
  const urls: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.method()} ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => urls.push(request.url()));
  return () => {
    expect(errors).toEqual([]);
    expect(urls.some(url => /@vite|@fs|node_modules|\.tsx?(?:\?|$)/.test(url))).toBe(false);
    expect(urls.some(url => url.endsWith('.css'))).toBe(true);
  };
}

test('two packaged experiences render and retain independent input and lifecycle state', async ({ page }, info) => {
  const verify = observe(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(demo.hostOrigin);
  const one = await ready(page);
  const two = await ready(page, 'two');
  const visiblePixels = await one.evaluate(() => {
    const three = (window as any).__URK_DOM_PROOF__.kernel.getContext().adapters.require('three');
    three.render();
    const gl = three.getRenderer().getContext() as WebGL2RenderingContext;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index]) visible++;
    return visible;
  });
  expect(visiblePixels).toBeGreaterThan(500);
  expect(await one.evaluate(() => {
    try { return parent.document.title; } catch (error) { return (error as Error).name; }
  })).toBe('SecurityError');
  await expect(page.locator('#one iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-forms');
  const positionOne = one.locator('[data-role="position-value"]');
  const positionTwo = two.locator('[data-role="position-value"]');
  const initialOne = await positionOne.textContent();
  const initialTwo = await positionTwo.textContent();
  await select(page, one);
  await page.keyboard.press('ArrowRight');
  await expect(positionOne).not.toHaveText(initialOne!);
  await expect(positionTwo).toHaveText(initialTwo!);
  await select(page, two);
  await page.keyboard.press('ArrowLeft');
  await expect(positionTwo).not.toHaveText(initialTwo!);
  const movedTwo = await positionTwo.textContent();
  await one.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(one.locator('[data-role="phase-value"]')).toHaveText('paused');
  await expect(two.locator('[data-role="phase-value"]')).toHaveText('ready');
  await one.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(one.locator('[data-role="phase-value"]')).toHaveText('ready');
  await page.locator('#one').getByRole('button', { name: 'Reload', exact: true }).click();
  await ready(page);
  expect(one.isDetached()).toBe(true);
  await expect(positionTwo).toHaveText(movedTwo!);
  await page.locator('#one').getByRole('button', { name: 'Unload', exact: true }).click();
  await expect(page.locator('#one iframe')).toHaveCount(0);
  await expect(page.locator('#one')).toHaveAttribute('data-state', 'idle');
  await expect(positionTwo).toHaveText(movedTwo!);
  await page.locator('#one').getByRole('button', { name: 'Play', exact: true }).click();
  await ready(page);
  await page.screenshot({ path: info.outputPath('players-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Remove player two' }).click();
  expect(two.isDetached()).toBe(true);
  await expect(page.locator('#one iframe')).toHaveCount(1);
  await page.getByRole('button', { name: 'Restore player two' }).click();
  await ready(page, 'two');
  verify();
});

test('responsive players accept touch inside the existing pointer adapter', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    const verify = observe(page);
    await page.goto(demo.hostOrigin);
    const frame = await ready(page);
    const second = await ready(page, 'two');
    await select(page, frame, true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('players-mobile-one.png') });
    await select(page, second, true);
    await page.screenshot({ path: info.outputPath('players-mobile-two.png') });
    verify();
  } finally { await context.close(); }
});

test('plain iframe hosts the same compiled experience without the component', async ({ page }) => {
  const verify = observe(page);
  await page.goto(`${demo.hostOrigin}/plain-iframe.html`);
  const frame = (await (await page.locator('iframe').elementHandle())!.contentFrame())!;
  await expect(frame.locator('[data-role="phase-value"]')).toHaveText('ready');
  await select(page, frame);
  expect(await page.evaluate(() => customElements.get('urk-player'))).toBeUndefined();
  verify();
});

test('CLI-generated Player and iframe pages work from a static hosting subpath', async ({ page }, info) => {
  const verify = observe(page);
  await page.goto(`${demo.hostOrigin}/generated/`);
  await expect(page).toHaveTitle('Picking <test> & "friends"');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Picking <test> & "friends"');
  const player = page.locator('#experience');
  const frame = await ready(page, 'experience');
  await expect(player).toHaveCSS('height', '640px');
  expect((await player.locator('iframe').boundingBox())!.height).toBeGreaterThan(500);
  await expect(player.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
  expect(new URL(frame.url()).search).toBe('?first=1&second=2');
  await select(page, frame);
  const position = frame.locator('[data-role="position-value"]');
  const before = await position.textContent();
  await page.keyboard.press('ArrowRight');
  await expect(position).not.toHaveText(before!);
  await player.getByRole('button', { name: 'Reload', exact: true }).click();
  await ready(page, 'experience');
  expect(frame.isDetached()).toBe(true);
  await page.screenshot({ path: info.outputPath('generated-embed.png'), fullPage: true });
  await page.getByRole('link', { name: 'Open the plain iframe version' }).click();
  await expect(page).toHaveURL(`${demo.hostOrigin}/generated/plain-iframe.html`);
  const fallback = (await (await page.locator('iframe').elementHandle())!.contentFrame())!;
  await expect(fallback.locator('[data-role="phase-value"]')).toHaveText('ready');
  await select(page, fallback);
  expect(await page.evaluate(() => customElements.get('urk-player'))).toBeUndefined();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  verify();
});

test('optional fullscreen and hosting without CORS checks keep working', async ({ page }) => {
  await page.goto(demo.hostOrigin);
  await ready(page);
  await page.locator('#one').getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('one');
  await page.locator('#one').getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  const headRequests: string[] = [];
  page.on('request', request => { if (request.method() === 'HEAD') headRequests.push(request.url()); });
  await page.locator('#one').evaluate(element => {
    element.removeAttribute('fullscreen');
    element.removeAttribute('check-src');
    element.setAttribute('title', 'Changed title');
  });
  await ready(page);
  await expect(page.locator('#one iframe')).toHaveAttribute('title', 'Changed title');
  await expect(page.locator('#one').getByRole('button', { name: 'Fullscreen', exact: true })).toBeHidden();
  expect(headRequests).toEqual([]);
});

test('invalid sources and HTTP failures produce useful errors and can be retried', async ({ page }) => {
  await page.goto(demo.hostOrigin);
  await ready(page);
  const player = page.locator('#one');
  for (const [url, message] of [
    [`${demo.hostOrigin}/same-origin`, 'separate experience origin'],
    ['javascript:alert(1)', 'HTTP or HTTPS'],
    ['file:///tmp/index.html', 'HTTP or HTTPS'],
    [`${demo.experienceOrigin}/demo.urkpkg`, 'Unpack'],
    [`${demo.experienceOrigin}/missing/`, 'HTTP 404'],
    [`${demo.experienceOrigin}/picking/urk.json`, 'HTML document'],
  ]) {
    await player.evaluate((element, value) => element.setAttribute('src', value), url);
    await expect(player).toHaveAttribute('data-state', 'error');
    await expect(player.getByRole('status')).toContainText(message);
    await expect(player.locator('iframe')).toHaveCount(0);
  }
  await page.route(`${demo.experienceOrigin}/blocked/`, route => route.abort());
  await player.evaluate((element, value) => element.setAttribute('src', value), `${demo.experienceOrigin}/blocked/`);
  await expect(player.getByRole('status')).toContainText('enable CORS');
  await player.evaluate((element, value) => element.setAttribute('src', value), `${demo.experienceOrigin}/picking/`);
  await ready(page);
  await player.evaluate(element => element.removeAttribute('src'));
  await expect(player).toHaveAttribute('data-state', 'idle');
  await expect(player.locator('iframe')).toHaveCount(0);
});

test('removal cancels pending checks, timers, and document listeners; reconnect starts fresh', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { listeners: new Set<unknown>(), signals: [] as AbortSignal[], timers: new Set<number>() };
    Object.assign(window, { playerProbe: probe });
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    document.addEventListener = ((type: string, listener: any, options: any) => {
      if (type === 'fullscreenchange') probe.listeners.add(listener);
      add(type, listener, options);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((type: string, listener: any, options: any) => {
      if (type === 'fullscreenchange') probe.listeners.delete(listener);
      remove(type, listener, options);
    }) as typeof document.removeEventListener;
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (input, options) => {
      if (options?.signal) probe.signals.push(options.signal);
      return fetchOriginal(input, options);
    };
    const timeout = window.setTimeout.bind(window);
    const clear = window.clearTimeout.bind(window);
    window.setTimeout = ((callback: TimerHandler, delay?: number) => {
      const id = timeout(callback, delay);
      if (delay === 15000) probe.timers.add(id);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = id => { if (typeof id === 'number') probe.timers.delete(id); clear(id); };
  });
  await page.goto(demo.hostOrigin);
  await ready(page);
  await ready(page, 'two');
  await page.route(`${demo.experienceOrigin}/pending/`, () => {});
  const player = page.locator('#one');
  await player.evaluate((element, value) => element.setAttribute('src', value), `${demo.experienceOrigin}/pending/`);
  await expect(player).toHaveAttribute('data-state', 'loading');
  await page.getByRole('button', { name: 'Remove player one' }).click();
  expect(await page.evaluate(() => {
    const probe = (window as any).playerProbe;
    return { listeners: probe.listeners.size, timers: probe.timers.size, aborted: probe.signals.at(-1).aborted };
  })).toEqual({ listeners: 1, timers: 0, aborted: true });
  await page.getByRole('button', { name: 'Restore player one' }).click();
  await player.evaluate((element, value) => element.setAttribute('src', value), `${demo.experienceOrigin}/picking/`);
  await ready(page);
  // A host listener can also unload synchronously in response to a loading state.
  await player.evaluate(element => {
    element.addEventListener('urk-player-statechange', () => (element as any).unload(), { once: true });
    (element as any).reload();
  });
  await expect(player).toHaveAttribute('data-state', 'idle');
  await expect(player.locator('iframe')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).playerProbe.timers.size)).toBe(0);
});

test('a stalled HTTP check times out and cleans up', async ({ page }) => {
  await page.goto(demo.hostOrigin);
  await ready(page);
  await ready(page, 'two');
  await page.clock.install();
  await page.route(`${demo.experienceOrigin}/stalled/`, () => {});
  await page.locator('#one').evaluate((element, value) => element.setAttribute('src', value), `${demo.experienceOrigin}/stalled/`);
  await expect(page.locator('#one')).toHaveAttribute('data-state', 'loading');
  await page.clock.fastForward(15001);
  await expect(page.locator('#one')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#one').getByRole('status')).toContainText('timed out');
  await expect(page.locator('#one iframe')).toHaveCount(0);
});

test('the existing Audio proof plays real assets after an in-frame gesture', async ({ page }) => {
  const verify = observe(page);
  await observeMedia(page);
  await page.goto(demo.hostOrigin);
  await ready(page);
  const other = await ready(page, 'two');
  const audioResponse = page.waitForResponse(`${demo.experienceOrigin}/audio/bed.wav`);
  await page.locator('#one').evaluate((element, value) => element.setAttribute('src', value), `${demo.experienceOrigin}/audio-proof/`);
  const frame = await ready(page);
  expect((await audioResponse).status()).toBe(200);
  await frame.locator('[data-role="play-button"]').click();
  await expect(frame.locator('[data-role="transport-value"]')).toHaveText('Playing');
  await expect.poll(() => frame.evaluate(() => [...(window as any).videoProbe.audio]
    .some((audio: any) => !audio.paused && audio.currentTime > 0))).toBe(true);
  await page.locator('#one').getByRole('button', { name: 'Unload', exact: true }).click();
  expect(frame.isDetached()).toBe(true);
  await expect(page.locator('#one iframe')).toHaveCount(0);
  await expect(other.locator('[data-role="phase-value"]')).toHaveText('ready');
  verify();
});
