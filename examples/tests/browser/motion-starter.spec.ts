/**
 * Company: EonHive Inc. | Title: Independent Motion Starter Proof
 * Purpose: Build copied sources with packed runtimes and verify static hosting and iframe lifecycle.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servePlayerDemo } from '../../../scripts/serve-player-demo.mjs';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

test('exported starter builds independently, runs at a subpath, and embeds in plain HTML', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  // Stay outside the checkout so Node cannot fall back to its installed dependencies.
  const temporary = await mkdtemp(join(tmpdir(), 'urk-motion-starter-'));
  const draft = join(temporary, 'exported');
  const project = join(temporary, 'project');
  const embedding = info.outputPath('embedding');
  let servers: Awaited<ReturnType<typeof servePlayerDemo>> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const run = (...args: string[]) =>
    execFileSync('corepack', ['yarn', ...args], {
      cwd: project,
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' },
    });
  try {
    execFileSync(process.execPath, [join(repo, 'scripts/create-motion-starter.mjs'), draft], {
      cwd: repo,
      encoding: 'utf8',
      timeout: 30000,
    });
    // Moving before install proves that runtime archive paths do not point back into the checkout.
    await rename(draft, project);
    expect(() =>
      execFileSync(process.execPath, [join(repo, 'scripts/create-motion-starter.mjs'), project], {
        cwd: repo,
        stdio: 'pipe',
      }),
    ).toThrow();
    const manifest = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
    expect(Object.keys(manifest.dependencies).sort()).toEqual(['@urk/adapters', '@urk/core']);
    expect(await readFile(join(project, 'widget/index.ts'), 'utf8')).not.toContain('@urk/examples');
    await info.attach('install.log', { body: run('install'), contentType: 'text/plain' });
    await info.attach('build.log', { body: run('build'), contentType: 'text/plain' });
    const html = await readFile(join(project, 'dist/index.html'), 'utf8');
    expect(html).toMatch(/src="\.\/assets\//);
    expect(html).not.toMatch(/src="[^"]*\.ts"/);
    await mkdir(embedding);
    servers = await servePlayerDemo({
      pickingDirectory: join(project, 'dist'),
      hostPort: 0,
      experiencePort: 0,
      extraMounts: [{ prefix: '/widget/', directory: join(project, 'dist') }],
      hostMounts: [{ prefix: '/external/', directory: embedding }],
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${servers.experienceOrigin}/widget/`);
    await expect(page.locator('#lifecycle')).toHaveText('running');
    const widget = page.getByRole('region', { name: 'Your signal motion widget', exact: true });
    const scrubber = widget.getByLabel('Scrub sequence', { exact: true });
    await scrubber.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    const pose = await widget.locator('.umw-tile').first().getAttribute('style');
    await page.getByRole('button', { name: 'Pause runtime', exact: true }).click();
    await expect(page.locator('#lifecycle')).toHaveText('paused');
    expect(await widget.locator('.umw-tile').first().getAttribute('style')).toBe(pose);
    await page.getByRole('button', { name: 'Resume runtime', exact: true }).click();
    await expect(widget.locator('.umw-status')).toHaveText('paused');
    await widget.getByRole('button', { name: 'Resume sequence', exact: true }).click();
    await expect(widget.locator('.umw-status')).toHaveText('completed');
    await page.getByRole('button', { name: 'Dispose runtime', exact: true }).click();
    await expect(widget).toHaveCount(0);
    await expect(page.locator('.umw-preferences')).toHaveCount(0);
    await expect(page.locator('.host-caption')).toBeVisible();
    await page.getByRole('button', { name: 'Restart runtime', exact: true }).click();
    await expect(page.locator('#instance')).toHaveText('2');
    await expect(widget).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(scrubber).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('starter-mobile.png'), fullPage: true });
    await writeFile(
      join(embedding, 'index.html'),
      `<!doctype html><title>External host</title><h1>My ordinary page</h1><iframe title="Motion embed" src="${servers.experienceOrigin}/widget/" width="100%" height="1200" style="border:0"></iframe>`,
    );
    await page.goto(`${servers.hostOrigin}/external/`);
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('#lifecycle')).toHaveText('running');
    await frame.getByRole('button', { name: 'Dispose runtime', exact: true }).click();
    await expect(frame.locator('.umw')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'My ordinary page' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await servers?.close();
    // Retain reviewable sources, local archives, and dist, without a duplicate dependency installation.
    if (existsSync(project)) {
      await rm(join(project, 'node_modules'), { recursive: true, force: true });
      await rm(join(project, '.yarn'), { recursive: true, force: true });
      await cp(project, info.outputPath('project'), { recursive: true });
    }
    await rm(temporary, { recursive: true, force: true });
  }
});
