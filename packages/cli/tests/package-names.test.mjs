/**
 * Company: EonHive Inc.
 * Title: CLI Package Naming Tests
 * Purpose: Verify current and legacy package detection and overlay alias additions.
 * Author: Stan Nesi
 * Created: 2026-10-12
 * Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { detectUrkPackages } from '../dist/utils/project.js';

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const header = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0] + '*/\n';

function run(fixture, args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: fixture, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('check and inspect recognize declared and missing dependencies under both wrapper names', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'urk-cli-names-'));
  try {
    mkdirSync(join(fixture, 'src'));
    for (const suffix of ['', '-urk']) {
      const dependencies = Object.fromEntries(['core', 'adapters', `react${suffix}`, `next${suffix}`]
        .map(name => [`@urk/${name}`, '^0.2.0']));
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'proof', dependencies }));
      writeFileSync(join(fixture, 'src/index.ts'), `${header}
import { UrkProvider } from '@urk/react${suffix}';
import { UrkNextProvider } from '@urk/next${suffix}';
import { createUiOverlayAdapter } from '@urk/adapters/ui-overlay';
`);
      assert.deepEqual(await detectUrkPackages(fixture), { core: true, adapters: true, reactUrk: true, nextUrk: true });
      const check = run(fixture, ['check']);
      assert.equal(check.status, 0, check.stdout + check.stderr);
      assert.ok(check.stdout.includes(`imports @urk/react${suffix} and declares it`));
      assert.ok(check.stdout.includes(`imports @urk/next${suffix} and declares it`));
      assert.ok(check.stdout.includes('imports @urk/adapters and declares it'));
      const inspect = run(fixture, ['inspect']);
      assert.equal(inspect.status, 0, inspect.stderr);
      assert.ok(inspect.stdout.includes(`@urk/react${suffix}: found`));
      assert.ok(inspect.stdout.includes(`@urk/next${suffix}: found`));
      assert.ok(inspect.stdout.includes('ui-overlay'));
      delete dependencies[`@urk/react${suffix}`];
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'proof', dependencies }));
      const missing = run(fixture, ['check']);
      assert.equal(missing.status, 1, missing.stdout);
      assert.ok(missing.stdout.includes(`does not declare @urk/react${suffix}`));
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('adding either overlay alias does not register its shared token twice', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'urk-cli-overlay-'));
  try {
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({
      dependencies: { '@urk/core': '^0.2.0', '@urk/adapters': '^0.2.0' },
    }));
    for (const [first, second] of [['ui-overlay', 'ui-widgets'], ['ui-widgets', 'ui-overlay']]) {
      const added = run(fixture, ['add', 'adapter', first]);
      assert.equal(added.status, 0, added.stdout + added.stderr);
      const path = join(fixture, 'src/adapters.ts');
      const original = readFileSync(path, 'utf8');
      assert.match(original, first === 'ui-overlay' ? /createUiOverlayAdapter\(\)/ : /createUiWidgetsAdapter\(\)/);
      const repeated = run(fixture, ['add', 'adapter', second]);
      assert.equal(repeated.status, 0, repeated.stdout + repeated.stderr);
      assert.equal(readFileSync(path, 'utf8'), original);
      rmSync(path);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
