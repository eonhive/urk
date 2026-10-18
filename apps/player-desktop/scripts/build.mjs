/**
 * Company: EonHive Inc. | Title: Desktop Player Build
 * Purpose: Bundle the native host with the existing Vite toolchain and copy the Web Player unchanged.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { build } from 'vite';
import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await rm(`${root}dist`, { recursive: true, force: true });
await mkdir(`${root}dist/shell`, { recursive: true });
for (const name of ['main', 'preload']) {
  await build({ configFile: false, root, publicDir: false, ssr: { noExternal: ['@urk/cli', '@zip.js/zip.js'] }, build: {
    target: 'node22', ssr: `src/${name}.ts`, outDir: 'dist', emptyOutDir: false, minify: false,
    rollupOptions: { external: ['electron'], output: { format: 'cjs', entryFileNames: `${name}.cjs`, inlineDynamicImports: true } },
  } });
}
await build({ configFile: false, root, publicDir: false, build: {
  target: 'es2022', outDir: 'dist/shell', emptyOutDir: false,
  lib: { entry: 'src/shell/shell.ts', formats: ['es'], fileName: () => 'shell.js' },
} });
await copyFile(`${root}src/shell/index.html`, `${root}dist/shell/index.html`);
await copyFile(`${root}src/shell/style.css`, `${root}dist/shell/style.css`);
await cp(`${root}src/player`, `${root}dist/player`, { recursive: true });
await copyFile(fileURLToPath(import.meta.resolve('@urk/player')), `${root}dist/player/urk-player.js`);
// Unit checks use the same build settings as the host; this file is excluded from the app artifact.
for (const name of ['package-store', 'local-content']) {
  await build({ configFile: false, root, publicDir: false, ssr: { noExternal: ['@urk/cli', '@zip.js/zip.js'] }, build: {
    target: 'node22', ssr: `src/${name}.ts`, outDir: 'dist/checks', emptyOutDir: false, minify: false,
    rollupOptions: { output: { format: 'es', entryFileNames: `${name}.mjs` } },
  } });
}
