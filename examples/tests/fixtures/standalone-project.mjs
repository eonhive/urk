/**
 * Company: EonHive Inc. | Title: Standalone Project Test Installation
 * Purpose: Test fresh scaffolds against packed local packages before registry publication.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

/** Install actual package archives, not workspace aliases or symlinks. */
export function installStandaloneProject(project, archives) {
  mkdirSync(archives, { recursive: true });
  const packages = {};
  for (const name of ['core', 'adapters', 'player', 'cli']) {
    const archive = join(archives, `${name}.tgz`);
    execFileSync('corepack', ['yarn', 'workspace', `@urk/${name}`, 'pack', '--out', archive], {
      cwd: repo, encoding: 'utf8', timeout: 60000,
    });
    packages[`@urk/${name}`] = `file:${archive}`;
  }
  const path = join(project, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  // Keep the generated sources and build script unchanged; these versions are not published yet.
  manifest.dependencies['@urk/core'] = packages['@urk/core'];
  manifest.dependencies['@urk/adapters'] = packages['@urk/adapters'];
  manifest.devDependencies['@urk/cli'] = packages['@urk/cli'];
  manifest.resolutions = { '@urk/player': packages['@urk/player'] };
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(project, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
  return execFileSync('corepack', ['yarn', 'install'], {
    cwd: project, encoding: 'utf8', timeout: 180000,
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' },
  });
}
