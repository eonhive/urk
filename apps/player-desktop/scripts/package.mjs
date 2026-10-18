/**
 * Company: EonHive Inc. | Title: macOS Player Packaging
 * Purpose: Produce a self-contained app with a uRK package document association.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { packager } from '@electron/packager';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../../../.codex/desktop/release/', import.meta.url));
if (process.platform !== 'darwin') throw new Error('This first packaging target requires macOS.');
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(output, '.app-source-'));
try {
  const manifest = JSON.parse(await readFile(`${root}package.json`, 'utf8'));
  await cp(`${root}dist`, `${staging}/dist`, { recursive: true, filter: path => !path.includes('/checks') });
  await writeFile(`${staging}/package.json`, JSON.stringify({ name: 'urk-player', version: manifest.version, main: 'dist/main.cjs' }));
  const directories = await packager({
    dir: staging, out: output, name: 'uRK Player', appBundleId: 'com.eonhive.urk-player',
    platform: 'darwin', arch: process.arch, electronVersion: manifest.devDependencies.electron,
    overwrite: true, asar: true, prune: false,
    appCopyright: 'EonHive Inc.',
    extendInfo: {
      CFBundleDocumentTypes: [{ CFBundleTypeName: 'uRK Portable Experience', CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Owner', LSItemContentTypes: ['com.eonhive.urkpkg'] }],
      UTExportedTypeDeclarations: [{ UTTypeIdentifier: 'com.eonhive.urkpkg', UTTypeDescription: 'uRK Portable Experience', UTTypeConformsTo: ['public.zip-archive'], UTTypeTagSpecification: { 'public.filename-extension': ['urkpkg'], 'public.mime-type': 'application/vnd.urk.package+zip' } }],
    },
  });
  for (const directory of directories) {
    const app = join(directory, 'uRK Player.app');
    // Local ad-hoc signature only. Developer ID signing/notarization requires the distributor's identity.
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
    execFileSync('ditto', ['-c', '-k', '--keepParent', app, join(output, `uRK-Player-macOS-${process.arch}.zip`)]);
    console.log(`Built ${app}`);
  }
} finally { await rm(staging, { recursive: true, force: true }); }
