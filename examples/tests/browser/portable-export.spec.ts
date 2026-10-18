/**
 * Company: EonHive Inc. | Title: Portable Web Export Browser Proof
 * Purpose: Exercise real CLI output through static HTTP hosting and a separate-origin iframe.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import { expect, test, type Frame, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const cli = join(repo, 'packages/cli/dist/index.js');
const mime: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
};
let temporary: string;
let assets: Server;
let parent: Server;
let assetOrigin: string;
let parentOrigin: string;

function runCli(args: string[], cwd = repo): string {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 60000 });
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static test server did not bind a TCP port.');
  return `http://127.0.0.1:${address.port}`;
}

test.beforeAll(async () => {
  test.setTimeout(60000);
  await mkdir(join(repo, '.codex/validation'), { recursive: true });
  temporary = await mkdtemp(join(repo, '.codex/validation/portable-browser-'));
  const portable = join(temporary, 'portable');
  const fixed = join(temporary, 'fixed');
  runCli(['export', 'examples/picking', '--out-dir', portable]);
  runCli(['export', 'examples/picking', '--out-dir', fixed, '--base', '/fixed/']);
  runCli(['create', 'starter'], temporary);
  runCli(['export'], join(temporary, 'starter'));
  const unpacked = join(temporary, 'unpacked');
  const archive = join(temporary, 'picking.urkpkg');
  runCli(['pack', portable, '--out', archive, '--name', 'Picking', '--type', 'game']);
  expect(runCli(['inspect', archive])).toContain('name: Picking');
  runCli(['unpack', archive, '--out-dir', unpacked]);
  const starterArchive = join(temporary, 'starter.urkpkg');
  const starterSite = join(temporary, 'starter-site');
  runCli(['pack', join(temporary, 'starter/dist'), '--out', starterArchive]);
  runCli(['unpack', starterArchive, '--out-dir', starterSite]);

  // Serve only completed artifacts, with no transforms, source fallback, or Vite server.
  const mounts = [
    { prefix: '/games/picking/', directory: portable },
    { prefix: '/packages/picking/', directory: unpacked },
    { prefix: '/fixed/', directory: fixed },
    { prefix: '/starter/', directory: starterSite },
    { prefix: '/', directory: portable },
  ];
  assets = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url!, 'http://static.test').pathname);
      const mount = mounts.find(item => pathname.startsWith(item.prefix))!;
      const file = resolve(mount.directory, pathname.slice(mount.prefix.length) || 'index.html');
      if (relative(mount.directory, file).startsWith('..')) throw new Error('Outside static root');
      const content = await readFile(file);
      response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' }).end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  assetOrigin = await listen(assets);
  const embed = (await readFile(join(repo, 'examples/portable-embed.html'), 'utf8'))
    .replace('http://127.0.0.1:8080/', `${assetOrigin}/packages/picking/`);
  parent = createServer((_request, response) => response.writeHead(200, { 'content-type': 'text/html' }).end(embed));
  parentOrigin = await listen(parent);
});

test.afterAll(async () => {
  for (const server of [parent, assets]) {
    if (server) await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
});

function observeRequests(page: Page) {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`Failed request: ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('request', request => requests.push(request.url()));
  return () => {
    expect(errors).toEqual([]);
    expect(requests.every(url => [assetOrigin, parentOrigin].includes(new URL(url).origin))).toBe(true);
    expect(requests.some(url => url.endsWith('.js'))).toBe(true);
    expect(requests.some(url => url.endsWith('.css'))).toBe(true);
    expect(requests.some(url => /@vite|@fs|node_modules|\.tsx?(?:\?|$)/.test(url))).toBe(false);
  };
}

async function checkPicking(page: Page, scope: Page | Frame): Promise<void> {
  await expect(scope.locator('[data-role="phase-value"]')).toHaveText('ready');
  // Draw and sample in the same browser task, before WebGL discards its back buffer.
  const pixels = await scope.evaluate(() => {
    const three = (window as any).__URK_DOM_PROOF__.kernel.getContext().adapters.require('three');
    three.render();
    const gl = three.getRenderer().getContext() as WebGL2RenderingContext;
    const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
    let visible = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 0) visible++;
    return visible;
  });
  expect(pixels).toBeGreaterThan(500);
  const target = scope.locator('[data-role="scene-target-a"]');
  await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
  // This sample continuously pulses its targets, so click their real coordinates without waiting for stillness.
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(target).toHaveAttribute('data-selected', 'true');
  const position = scope.locator('[data-role="position-value"]');
  const before = await position.textContent();
  await page.keyboard.press('ArrowRight');
  await expect(position).not.toHaveText(before!);
  await expect(scope.locator('[data-role="input-value"]')).toContainText('ArrowRight');
  await scope.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(scope.locator('[data-role="phase-value"]')).toHaveText('paused');
  await scope.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(scope.locator('[data-role="phase-value"]')).toHaveText('ready');
}

for (const route of ['/', '/games/picking/', '/fixed/', '/packages/picking/']) {
  test(`portable export runs from static hosting at ${route}`, async ({ page }) => {
    const verifyRequests = observeRequests(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${assetOrigin}${route}`);
    await checkPicking(page, page);
    await page.getByRole('button', { name: 'Shutdown', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).__URK_DOM_PROOF__.kernel.getLifecycleSnapshot().state)).toBe('disposed');
    verifyRequests();
  });
}

test('unpacked experience embeds in a responsive unrelated HTML website', async ({ page }, info) => {
  const verifyRequests = observeRequests(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(parentOrigin);
  const iframe = page.locator('iframe');
  await expect(page.frameLocator('iframe').locator('[data-role="phase-value"]')).toHaveText('ready');
  const frame = (await (await iframe.elementHandle())!.contentFrame())!;
  expect(new URL(frame.url()).origin).not.toBe(new URL(page.url()).origin);
  await checkPicking(page, frame);
  await page.screenshot({ path: info.outputPath('embed-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await frame.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('embed-mobile.png'), fullPage: true });
  verifyRequests();
});

test('unpacked generated starter loads public content under a subpath and handles input', async ({ page }) => {
  const verifyRequests = observeRequests(page);
  const content = page.waitForResponse(`${assetOrigin}/starter/content.json`);
  await page.goto(`${assetOrigin}/starter/`);
  expect((await content).status()).toBe(200);
  await expect(page.locator('[data-role="phase-value"]')).toHaveText('ready');
  await expect(page.locator('[data-role="message-value"]')).toHaveText('Your URK v2 runtime is ready');
  await page.keyboard.press('h');
  await expect(page.locator('[data-overlay-callout]')).toContainText('Typed capabilities');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('[data-role="lifecycle-value"]')).toHaveText('disposed');
  await page.getByRole('button', { name: 'Start fresh', exact: true }).click();
  await expect(page.locator('[data-role="phase-value"]')).toHaveText('ready');
  verifyRequests();
});
