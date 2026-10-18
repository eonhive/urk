/**
 * Company: EonHive Inc. | Title: Desktop Player Proof
 * Purpose: Exercise a real packaged uRK app, desktop controls, isolation, saves, and cleanup in Electron.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { _electron as electron, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

test('Picking opens, plays, suspends, restarts, isolates and cleans up in the desktop Player', { timeout: 120000 }, async () => {
  const artifacts = join(repo, '.codex/desktop');
  await mkdir(artifacts, { recursive: true });
  const temporary = await mkdtemp(join(artifacts, 'test-'));
  const archive = join(temporary, 'picking.urkpkg');
  const profile = join(temporary, 'profile');
  const cli = (...args) => execFileSync(process.execPath, [join(repo, 'packages/cli/dist/index.js'), ...args], { cwd: repo, encoding: 'utf8' });
  cli('export', 'examples/picking', '--out-dir', join(temporary, 'export'));
  cli('pack', join(temporary, 'export'), '--out', archive, '--name', 'Picking', '--type', 'game');
  const binary = process.env.URK_PLAYER_EXECUTABLE;
  const application = await electron.launch({
    ...(binary ? { executablePath: binary } : {}),
    args: [...(binary ? [] : [join(repo, 'apps/player-desktop')]), `--user-data-dir=${profile}`],
    timeout: 30000,
  });
  const failures = [];
  application.process().stderr.on('data', data => appendFileSync(join(artifacts, 'electron-test.log'), data));
  application.context().on('page', page => page.on('pageerror', error => failures.push(error.message)));
  try {
    const shell = await application.firstWindow();
    await expect(shell.locator('#open')).toBeVisible();
    // Stub only the native dialog selection. The button, IPC sender validation, and load path are real.
    await application.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
    }, archive);
    await shell.locator('#open').click();
    await expect(shell.locator('body')).toHaveAttribute('data-phase', 'playing', { timeout: 30000 });
    await expect(shell.locator('#metadata')).toHaveText('Picking · 0.1.0 · game');
    const player = application.context().pages().find(page => page.url().startsWith('https://player.urk.invalid'));
    assert.ok(player);
    const frame = player.frames().find(frame => new URL(frame.url()).hostname.endsWith('.experience.urk.invalid'));
    assert.ok(frame);
    await expect(frame.locator('[data-role="phase-value"]')).toHaveText('ready');
    const visible = await frame.evaluate(() => {
      const three = window.__URK_DOM_PROOF__.kernel.getContext().adapters.require('three');
      three.render();
      const gl = three.getRenderer().getContext();
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels.filter((value, index) => index % 4 === 3 && value > 0).length;
    });
    assert.ok(visible > 500);
    const target = frame.locator('[data-role="scene-target-a"]');
    await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
    const box = await target.boundingBox();
    await player.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(target).toHaveAttribute('data-selected', 'true');
    const position = await frame.locator('[data-role="position-value"]').textContent();
    await player.keyboard.press('ArrowRight');
    await expect(frame.locator('[data-role="position-value"]')).not.toHaveText(position);
    await frame.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(frame.locator('[data-role="phase-value"]')).toHaveText('paused');
    await frame.getByRole('button', { name: 'Resume', exact: true }).click();

    let ticks = 0;
    player.on('console', message => { if (message.text() === 'desktop-test-tick') ticks++; });
    await frame.evaluate(() => { setInterval(() => console.log('desktop-test-tick'), 20); localStorage.setItem('desktop-proof', 'saved'); });
    await expect.poll(() => ticks).toBeGreaterThan(2);
    await shell.locator('[data-action="pause"]').click();
    await expect(shell.locator('body')).toHaveAttribute('data-phase', 'paused');
    const before = ticks;
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(ticks, before);
    await shell.locator('[data-action="pause"]').click();
    await expect.poll(() => ticks).toBeGreaterThan(before);
    await shell.locator('[data-action="fullscreen"]').click();
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
    await shell.locator('[data-action="fullscreen"]').click();
    await expect.poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false);

    assert.deepEqual(await frame.evaluate(() => ({ node: typeof require, process: typeof process, bridge: typeof window.desktop })), { node: 'undefined', process: 'undefined', bridge: 'undefined' });
    assert.equal(await frame.evaluate(() => { try { return parent.document.title; } catch (error) { return error.name; } }), 'SecurityError');
    const blocked = await frame.evaluate(async () => {
      const urls = ['https://example.com/', 'http://127.0.0.1:1/', 'file:///etc/hosts', 'https://shell.urk.invalid/index.html'];
      return Promise.all(urls.map(url => fetch(url).then(() => false, () => true)));
    });
    assert.deepEqual(blocked, [true, true, true, true]);
    assert.equal(await frame.evaluate(() => window.open('https://example.com') === null), true);
    assert.equal(await frame.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state), 'denied');
    const preferences = await application.evaluate(({ webContents }) => webContents.getAllWebContents().filter(contents => contents.getURL().startsWith('https://player.')).map(contents => contents.getLastWebPreferences()));
    assert.equal(preferences[0].sandbox, true);
    assert.equal(preferences[0].nodeIntegration, false);
    assert.equal(preferences[0].preload, undefined);

    await shell.locator('[data-action="restart"]').click();
    await expect.poll(() => frame.isDetached()).toBe(true);
    const fresh = player.frames().find(frame => new URL(frame.url()).hostname.endsWith('.experience.urk.invalid'));
    await expect(fresh.locator('[data-role="phase-value"]')).toHaveText('ready');
    assert.equal(await fresh.evaluate(() => localStorage.getItem('desktop-proof')), 'saved');
    await player.screenshot({ path: join(artifacts, binary ? 'installed-experience.png' : 'desktop-experience.png') });
    await shell.screenshot({ path: join(artifacts, binary ? 'installed-shell.png' : 'desktop-shell.png') });
    await shell.locator('[data-action="unload"]').click();
    await expect(shell.locator('body')).toHaveAttribute('data-phase', 'idle');
    assert.equal(player.isClosed(), true);
    assert.deepEqual(await readdir(join(profile, 'Extracted')), []);

    // Deliver a disk-backed File through a real DOM drop event; no path-taking renderer API exists.
    await shell.evaluate(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'test-drop'; document.body.append(input); });
    await shell.locator('#test-drop').setInputFiles(archive);
    await shell.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(document.querySelector('#test-drop').files[0]);
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    });
    await expect(shell.locator('body')).toHaveAttribute('data-phase', 'playing', { timeout: 30000 });
    const reopened = application.context().pages().find(page => page.url().startsWith('https://player.urk.invalid'));
    const reopenedFrame = reopened.frames().find(frame => new URL(frame.url()).hostname.endsWith('.experience.urk.invalid'));
    await expect(reopenedFrame.locator('[data-role="phase-value"]')).toHaveText('ready');
    assert.equal(await reopenedFrame.evaluate(() => localStorage.getItem('desktop-proof')), 'saved');
    await writeFile(join(temporary, 'broken.urkpkg'), 'not a zip');
    await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, join(temporary, 'broken.urkpkg'));
    await shell.locator('#open').click();
    await expect(shell.locator('body')).toHaveAttribute('data-phase', 'error');
    await expect(shell.locator('#status')).toContainText('Invalid .urkpkg');
    assert.equal((await readdir(join(profile, 'Extracted'))).length, 1);
    await expect(reopenedFrame.locator('[data-role="phase-value"]')).toHaveText('ready');
    assert.deepEqual(failures, []);
  } finally {
    await application.close();
    assert.equal(await readdir(join(profile, 'Extracted')).catch(() => null), null);
    await rm(temporary, { recursive: true, force: true });
  }
});
