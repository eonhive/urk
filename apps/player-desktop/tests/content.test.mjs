/**
 * Company: EonHive Inc. | Title: Desktop Content Checks
 * Purpose: Check read-only local delivery and private extraction cleanup around the shared validator.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, truncate, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packWebsite } from '@urk/cli/portable-package';
import { localResponse, contentPolicy } from '../dist/checks/local-content.mjs';
import { preparePackage, releasePackage } from '../dist/checks/package-store.mjs';

test('local content is read-only, bounded to its root, and supports media ranges', async () => {
  const root = await mkdtemp(join(realpathSync(tmpdir()), 'urk-content-'));
  try {
    await mkdir(join(root, 'site'));
    await writeFile(join(root, 'site/index.html'), 'hello world');
    await writeFile(join(root, 'outside'), 'private');
    await symlink(join(root, 'outside'), join(root, 'site/link'));
    const request = (path, options) => localResponse(new Request(`https://test.invalid${path}`, options), join(root, 'site'), contentPolicy());
    const response = await request('/');
    assert.equal(await response.text(), 'hello world');
    assert.match(response.headers.get('content-security-policy'), /worker-src 'none'/);
    assert.equal((await request('/', { method: 'POST' })).status, 405);
    assert.equal((await request('/missing')).status, 404);
    assert.equal((await request('/link')).status, 403);
    assert.equal((await request('/..%2foutside')).status, 400);
    assert.equal((await request('/%5coutside')).status, 400);
    assert.equal((await request('/', { method: 'HEAD' })).headers.get('content-length'), '11');
    const range = await request('/', { headers: { range: 'bytes=6-10' } });
    assert.equal(range.status, 206);
    assert.equal(await range.text(), 'world');
    assert.equal((await request('/', { headers: { range: 'bytes=99-' } })).status, 416);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('package snapshots reuse validation, set read-only files, and clean failures', async () => {
  const root = await mkdtemp(join(realpathSync(tmpdir()), 'urk-store-'));
  try {
    const source = join(root, 'source');
    const scratch = join(root, 'scratch');
    const archive = join(root, 'proof.urkpkg');
    await mkdir(source);
    await writeFile(join(source, 'index.html'), '<html><body>Compiled proof</body></html>');
    await packWebsite(source, archive, { formatVersion: 1, name: 'Proof', version: '1', type: 'app', entrypoint: 'index.html' }, false);
    const opened = await preparePackage(archive, scratch);
    assert.equal(opened.manifest.name, 'Proof');
    assert.equal((await stat(join(opened.directory, 'index.html'))).mode & 0o222, 0);
    assert.equal(await readFile(join(opened.directory, 'index.html'), 'utf8'), '<html><body>Compiled proof</body></html>');
    const second = await preparePackage(archive, scratch);
    assert.equal(second.digest, opened.digest);
    await releasePackage(second);
    await releasePackage(opened);
    await writeFile(join(root, 'broken.urkpkg'), 'not a zip');
    await assert.rejects(preparePackage(join(root, 'broken.urkpkg'), scratch), /Invalid/);
    assert.deepEqual(await readdir(scratch), []);
    await symlink(archive, join(root, 'linked.urkpkg'));
    await assert.rejects(preparePackage(join(root, 'linked.urkpkg'), scratch));
    await writeFile(join(root, 'huge.urkpkg'), '');
    await truncate(join(root, 'huge.urkpkg'), 256 * 1024 * 1024 + 1);
    await assert.rejects(preparePackage(join(root, 'huge.urkpkg'), scratch), /256 MiB/);
    assert.deepEqual(await readdir(scratch), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
