/**
 * Company: EonHive Inc. | Title: Static Player Demo Servers
 * Purpose: Serve the optional Player and compiled experiences on separate local origins.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

async function listen(server, port) {
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', done);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function close(server) {
  server.closeAllConnections();
  return new Promise((done) => server.close(done));
}

async function staticFile(directory, pathname) {
  const root = await realpath(directory);
  let file = await realpath(resolve(root, pathname || 'index.html'));
  if ((await stat(file)).isDirectory()) file = await realpath(resolve(file, 'index.html'));
  const path = relative(root, file);
  if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) throw new Error('Outside static root');
  return { file, content: await readFile(file) };
}

/**
 * No development transforms or source fallback; tests use the same servers on ephemeral ports.
 * @param {{ pickingDirectory?: string, hostPort?: number, experiencePort?: number,
 *   extraMounts?: Array<{ prefix: string, directory: string }>,
 *   hostMounts?: Array<{ prefix: string, directory: string }> }} options
 */
export async function servePlayerDemo({
  pickingDirectory = resolve(repo, '.codex/player/picking'),
  hostPort = 8090,
  experiencePort = 8091,
  extraMounts = [],
  hostMounts = [],
} = {}) {
  const mounts = [{ prefix: '/picking/', directory: pickingDirectory }, ...extraMounts];
  const experiences = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://static.test').pathname);
      const mount = mounts.find(item => pathname.startsWith(item.prefix));
      if (!mount) throw new Error('Unknown route');
      const { file, content } = await staticFile(mount.directory, pathname.slice(mount.prefix.length));
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(404).end('Not found'); }
  });
  const experienceOrigin = await listen(experiences, experiencePort);
  const hosts = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const pathname = new URL(request.url, 'http://static.test').pathname;
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const mount = hostMounts.find(item => pathname.startsWith(item.prefix));
      if (mount) {
        const { file, content } = await staticFile(mount.directory, decodeURIComponent(pathname.slice(mount.prefix.length)));
        response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
        response.end(request.method === 'HEAD' ? undefined : content);
        return;
      }
      const routes = {
        '/': 'examples/player/index.html',
        '/index.html': 'examples/player/index.html',
        '/plain-iframe.html': 'examples/player/plain-iframe.html',
        '/urk-player.js': 'packages/player/dist/urk-player.js',
      };
      const file = routes[pathname];
      if (!file) throw new Error('Unknown route');
      const content = (await readFile(resolve(repo, file), 'utf8'))
        .replaceAll('http://127.0.0.1:8091', experienceOrigin);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(404).end('Not found'); }
  });
  try {
    const hostOrigin = await listen(hosts, hostPort);
    return { hostOrigin, experienceOrigin, close: async () => { await Promise.all([close(hosts), close(experiences)]); } };
  } catch (error) {
    await close(experiences);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const demo = await servePlayerDemo();
    console.log(`Player demo: ${demo.hostOrigin}/\nExperience: ${demo.experienceOrigin}/picking/\nPress Ctrl+C to stop.`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void demo.close(); });
  } catch (error) {
    console.error(`Could not serve Player demo: ${error.message}`);
    process.exitCode = 1;
  }
}
