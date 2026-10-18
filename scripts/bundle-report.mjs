/**
 * Company: EonHive Inc.
 * Title: URK Package and Bundle Report
 * Purpose: Measure publishable packages and representative browser bundles from built exports.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build, version as viteVersion } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, '.codex/validation/bundle-report');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const fixtures = [
  { name: 'core', exports: ["export { createKernel } from '@urk/core';"] },
  { name: 'dom', exports: ["export { createKernel } from '@urk/core';", "export * from '@urk/adapters/dom';"] },
  { name: 'three', exports: ["export { createKernel } from '@urk/core';", "export * from '@urk/adapters/three';"], three: true },
  { name: 'react', exports: ["export { createKernel } from '@urk/core';", "export * from '@urk/react';"], external: ['react', 'react-dom'] },
  { name: 'next', exports: ["export { createKernel } from '@urk/core';", "export * from '@urk/next';"], external: ['react', 'react-dom', 'next'] },
];

await mkdir(output, { recursive: true });
// Remove old success reports so a failed run cannot leave misleading current evidence.
await rm(join(output, 'report.json'), { force: true });
await rm(join(output, 'report.md'), { force: true });
const temporary = await mkdtemp(join(root, '.codex/validation/bundle-fixture-'));
try {
  const packages = [];
  for (const path of manifest.workspaces) {
    const workspace = JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8'));
    if (workspace.private) continue;
    // Check built outputs before packing; source-only reports are not release evidence.
    await readFile(join(root, path, workspace.main));
    await readFile(join(root, path, workspace.types));
    const [packed] = JSON.parse(command('npm', [
      'pack', '--workspace', workspace.name, '--ignore-scripts', '--pack-destination', temporary, '--json',
    ]));
    assert.ok(packed.files.some(file => file.path === workspace.main.replace(/^\.\//, '')));
    assert.ok(packed.files.some(file => file.path === workspace.types.replace(/^\.\//, '')));
    packages.push({ name: packed.name, version: packed.version, archiveBytes: packed.size,
      unpackedBytes: packed.unpackedSize, files: packed.entryCount, integrity: packed.integrity });
  }

  const bundles = [];
  for (const fixture of fixtures) bundles.push(await measureBundle(fixture, temporary));
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    head: command('git', ['rev-parse', 'HEAD']).trim(),
    workingChanges: command('git', ['status', '--porcelain']).trim().length > 0,
    tools: { node: process.version, npm: command('npm', ['--version']).trim(),
      packageManager: manifest.packageManager, vite: viteVersion },
    lockfileSha256: hash(await readFile(join(root, 'yarn.lock'))),
    protocol: { target: 'es2020', format: 'es', minifier: 'esbuild', sourcemaps: false,
      gzipLevel: 9, brotliQuality: 11, imports: 'built public exports',
      scope: 'Exported library surfaces, not a full application. React/Next framework peers are external.' },
    packages,
    bundles,
  };
  await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = renderMarkdown(report);
  await writeFile(join(output, 'report.md'), markdown);
  process.stdout.write(markdown);
  process.stdout.write('\nReports saved to .codex/validation/bundle-report/\n');
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function measureBundle(fixture, directory) {
  const entry = join(directory, `${fixture.name}.mjs`);
  await writeFile(entry, `/**
 * Company: EonHive Inc.
 * Title: Generated URK Bundle Fixture
 * Purpose: Retain the measured public exports in a browser bundle.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */
${fixture.exports.join('\n')}\n`);
  const peers = fixture.external ?? [];
  const result = await build({
    root, configFile: false, envFile: false, logLevel: 'error',
    build: { write: false, target: 'es2020', minify: 'esbuild', sourcemap: false,
      rollupOptions: { input: entry, preserveEntrySignatures: 'strict',
        external: id => peers.some(peer => id === peer || id.startsWith(`${peer}/`)),
        onwarn(warning, warn) {
          // This measures a browser-only fixture; package files retain their client directives.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
          warn(warning);
        },
        output: { format: 'es', entryFileNames: `${fixture.name}.js`, inlineDynamicImports: true },
      },
    },
  });
  assert.ok('output' in result, 'Expected one browser bundle output');
  assert.equal(result.output.length, 1, 'Report compression separately if a fixture gains assets or chunks');
  const chunk = result.output[0];
  assert.equal(chunk.type, 'chunk');
  assert.ok(chunk.exports.length > 0, 'Fixture exports must survive tree shaking');
  const modules = Object.keys(chunk.modules);
  const includesThree = modules.some(id => id.replaceAll('\\', '/').includes('/node_modules/three/'));
  assert.equal(includesThree, fixture.three ?? false, `${fixture.name}: unexpected Three.js inclusion`);
  assert.ok(!modules.some(id => id.includes('__vite-browser-external')), 'Node-only dependencies reached a browser bundle');
  assert.ok(!modules.some(id => /\/packages\/[^/]+\/src\//.test(id)), 'Bundle must use built package exports');
  for (const dependency of chunk.imports) {
    assert.ok(peers.some(peer => dependency === peer || dependency.startsWith(`${peer}/`)),
      `Unexpected external import: ${dependency}`);
  }
  const code = Buffer.from(chunk.code);
  return { name: fixture.name, entry: fixture.exports, rawBytes: code.length,
    gzipBytes: gzipSync(code, { level: 9 }).length,
    brotliBytes: brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    sha256: hash(code), modules: modules.length, includesThree,
    externalImports: chunk.imports, externalPeers: peers };
}

function command(program, args) {
  return execFileSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function renderMarkdown(report) {
  const lines = [
    '# URK package and browser bundle sizes', '',
    `Node ${report.tools.node}; ${report.tools.packageManager}; Vite ${report.tools.vite}.`, '',
    'Package sizes are npm tarball/download and unpacked bytes, including declarations and package metadata.', '',
    '| Package | Version | Archive bytes | Unpacked bytes | Files |',
    '| --- | --- | ---: | ---: | ---: |',
    ...report.packages.map(item => `| ${item.name} | ${item.version} | ${item.archiveBytes} | ${item.unpackedBytes} | ${item.files} |`), '',
    'Browser sizes are minified ES2020 library fixtures. Core is included in every fixture; Three is included only in its fixture. Framework peers are external. These are not full application download sizes.', '',
    '| Fixture | Minified bytes | Gzip bytes | Brotli bytes | External imports |',
    '| --- | ---: | ---: | ---: | --- |',
    ...report.bundles.map(item => `| ${item.name} | ${item.rawBytes} | ${item.gzipBytes} | ${item.brotliBytes} | ${item.externalImports.join(', ') || 'none'} |`), '',
    'Reporting establishes a baseline; no arbitrary size regression threshold is enforced.', '',
  ];
  return lines.join('\n');
}
