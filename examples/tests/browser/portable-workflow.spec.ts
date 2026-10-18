/**
 * Company: EonHive Inc. | Title: Complete Portable Experience Proof
 * Purpose: Verify the scaffold's ordinary build before embedding, packaging, and playing the same app.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { expect, test, type Frame, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installStandaloneProject } from '../fixtures/standalone-project.mjs';
import { servePlayerDemo } from '../../../scripts/serve-player-demo.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

async function interact(page: Page, scope: Page | Frame) {
  await expect(scope.locator('[data-role="phase-value"]')).toHaveText('ready');
  await expect(scope.locator('[data-role="message-value"]')).toHaveText('Your URK v2 runtime is ready');
  await expect(scope.locator('.app-shell')).toHaveCSS('display', 'grid');
  await scope.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(scope.locator('[data-role="lifecycle-value"]')).toHaveText('paused');
  await scope.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(scope.locator('[data-role="lifecycle-value"]')).toHaveText('running');
  // The pointer click gives the iframe keyboard focus; the existing input adapter owns KeyH.
  await page.keyboard.press('h');
  await expect(scope.locator('[data-overlay-callout]')).toContainText('Typed capabilities');
  await scope.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(scope.locator('[data-role="lifecycle-value"]')).toHaveText('disposed');
  await scope.getByRole('button', { name: 'Start fresh', exact: true }).click();
  await expect(scope.locator('[data-role="phase-value"]')).toHaveText('ready');
}

async function iframe(page: Page): Promise<Frame> {
  const element = await page.locator('iframe').elementHandle();
  return (await element!.contentFrame())!;
}

test('create → yarn build → static host → iframe → package → inspect → unpack → Player', async ({ page }, info) => {
  test.setTimeout(180000);
  await mkdir(join(repo, '.codex/validation'), { recursive: true });
  const temporary = await mkdtemp(join(repo, '.codex/validation/complete-portable-'));
  const project = join(temporary, 'starter');
  const dist = join(project, 'dist');
  let servers: Awaited<ReturnType<typeof servePlayerDemo>> | undefined;
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => requests.push(request.url()));
  const yarn = (...args: string[]) => execFileSync('corepack', ['yarn', ...args], {
    cwd: project, encoding: 'utf8', timeout: 60000,
  });
  try {
    await test.step('create, install packed local dependencies, and run the unchanged yarn build script', async () => {
      execFileSync(process.execPath, [join(repo, 'packages/cli/dist/index.js'), 'create', 'starter'], {
        cwd: temporary, encoding: 'utf8', timeout: 30000,
      });
      const installLog = installStandaloneProject(project, join(temporary, 'packages'));
      await info.attach('standalone-install.log', { body: installLog, contentType: 'text/plain' });
      const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
      expect(manifest.scripts.build).toBe('tsc --noEmit && vite build');
      const buildLog = yarn('build');
      await info.attach('standalone-build.log', { body: buildLog, contentType: 'text/plain' });
      const html = await readFile(join(dist, 'index.html'), 'utf8');
      expect(html).toMatch(/src="\.\/assets\/[^"\s]+\.js"/);
      expect(html).toMatch(/href="\.\/assets\/[^"\s]+\.css"/);
      expect(html).not.toMatch(/\/src\/|\.ts["']/);
      expect(await readFile(join(dist, 'content.json'), 'utf8')).toBe(await readFile(join(project, 'public/content.json'), 'utf8'));
    });

    servers = await servePlayerDemo({
      pickingDirectory: dist, hostPort: 0, experiencePort: 0,
      extraMounts: [{ prefix: '/starter/', directory: dist }, { prefix: '/unpacked/', directory: join(temporary, 'site') }],
      hostMounts: [{ prefix: '/external/', directory: join(temporary, 'embed') }, { prefix: '/packaged/', directory: join(temporary, 'player') }],
    });
    const { experienceOrigin, hostOrigin } = servers;

    await test.step('run the production build at a static HTTP subpath', async () => {
      const content = page.waitForResponse(`${experienceOrigin}/starter/content.json`);
      await page.goto(`${experienceOrigin}/starter/`);
      expect((await content).status()).toBe(200);
      await interact(page, page);
    });

    await test.step('embed in ordinary external HTML and verify cleanup when navigating away', async () => {
      yarn('urk', 'embed', `${experienceOrigin}/starter/`, '--out-dir', '../embed', '--title', 'Standalone proof');
      await page.goto(`${hostOrigin}/external/plain-iframe.html`);
      const frame = await iframe(page);
      expect(new URL(frame.url()).origin).not.toBe(new URL(page.url()).origin);
      await interact(page, frame);
      const exits: string[] = [];
      await page.exposeFunction('__recordPortableExit', (state: string) => exits.push(state));
      // Observe after the application's existing beforeunload hook. No production bridge is added.
      await frame.evaluate(() => {
        window.addEventListener('beforeunload', () => {
          void (window as any).__recordPortableExit(document.querySelector('[data-role="lifecycle-value"]')?.textContent).catch(() => {});
        }, { once: true });
      });
      await page.goto('about:blank');
      expect(frame.isDetached()).toBe(true);
      await expect.poll(() => exits.some(state => state === 'disposing' || state === 'disposed')).toBe(true);
    });

    await test.step('package the verified build, inspect its manifest, and unpack unchanged web files', async () => {
      yarn('urk', 'pack', 'dist', '--out', '../starter.urkpkg', '--name', 'Standalone proof', '--type', 'app');
      const report = yarn('urk', 'inspect', '../starter.urkpkg');
      expect(report).toContain('name: Standalone proof');
      expect(report).toContain('type: app');
      await info.attach('package-inspection.txt', { body: report, contentType: 'text/plain' });
      yarn('urk', 'unpack', '../starter.urkpkg', '--out-dir', '../site');
      for (const name of await readdir(dist, { recursive: true })) {
        if (!(await stat(join(dist, name))).isFile()) continue;
        expect(await readFile(join(temporary, 'site', name))).toEqual(await readFile(join(dist, name)));
      }
    });

    await test.step('open the extracted entrypoint in the existing Player and verify reload/removal', async () => {
      const manifest = JSON.parse(await readFile(join(temporary, 'site/urk.json'), 'utf8'));
      yarn('urk', 'embed', `${experienceOrigin}/unpacked/${manifest.entrypoint}`, '--out-dir', '../player', '--title', manifest.name, '--fullscreen');
      await page.goto(`${hostOrigin}/packaged/`);
      const player = page.locator('urk-player');
      await expect(player).toHaveAttribute('data-state', 'loaded');
      const first = await iframe(page);
      await interact(page, first);
      await player.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect(player).toHaveAttribute('data-state', 'loaded');
      expect(first.isDetached()).toBe(true);
      const fresh = await iframe(page);
      await interact(page, fresh);
      await page.screenshot({ path: info.outputPath('complete-portable.png'), fullPage: true });
      await player.evaluate(element => element.remove());
      expect(fresh.isDetached()).toBe(true);
      await expect(page.locator('iframe')).toHaveCount(0);
    });
    expect(errors).toEqual([]);
    expect(requests.some(url => /@vite|@fs|node_modules|\.tsx?(?:\?|$)/.test(url))).toBe(false);
    expect(requests.every(url => [hostOrigin, experienceOrigin].includes(new URL(url).origin))).toBe(true);
  } finally {
    await page.goto('about:blank');
    if (servers) await servers.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
