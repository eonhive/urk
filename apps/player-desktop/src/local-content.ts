/**
 * Company: EonHive Inc. | Title: Desktop Local Content
 * Purpose: Serve only validated package files through controlled origins without a network listener.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';

export const SHELL_ORIGIN = 'https://shell.urk.invalid';
export const PLAYER_ORIGIN = 'https://player.urk.invalid';
export const packageOrigin = (digest: string) => `https://${digest}.experience.urk.invalid`;

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain', '.vtt': 'text/vtt',
};

export function contentPolicy(frameOrigin?: string): string {
  return [
    "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "media-src 'self' blob:", "font-src 'self' data:",
    "connect-src 'self'", "worker-src 'none'", "object-src 'none'", "base-uri 'none'",
    "form-action 'none'", `frame-src ${frameOrigin ?? "'none'"}`,
    `frame-ancestors ${frameOrigin ? "'none'" : PLAYER_ORIGIN}`,
  ].join('; ');
}

/** The caller maps an exact origin to a private directory; no URL can select another directory. */
export async function localResponse(request: Request, directory: string, policy: string): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Read-only content.', { status: 405 });
  try {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) {
      return new Response('Invalid path.', { status: 400 });
    }
    const filename = join(directory, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    const canonical = await realpath(filename);
    const child = relative(await realpath(directory), canonical);
    if (!child || isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`) || !(await lstat(filename)).isFile()) {
      return new Response('Not a package file.', { status: 403 });
    }
    const size = (await lstat(canonical)).size;
    const headers = new Headers({
      'Content-Type': mime[extname(canonical).toLowerCase()] ?? 'application/octet-stream',
      'Content-Security-Policy': policy, 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), usb=(), serial=(), hid=()',
    });
    let start = 0;
    let end = size - 1;
    const range = request.headers.get('range');
    if (range) {
      const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!parts || (!parts[1] && !parts[2])) return new Response(null, { status: 416 });
      start = parts[1] ? Number(parts[1]) : Math.max(0, size - Number(parts[2]));
      end = parts[1] && parts[2] ? Math.min(size - 1, Number(parts[2])) : size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    headers.set('Content-Length', String(Math.max(0, end - start + 1)));
    const body = request.method === 'HEAD' || !size ? null
      : Readable.toWeb(createReadStream(canonical, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    const missing = ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '');
    return new Response(missing ? 'Package asset not found.' : 'Cannot read package asset.', { status: missing ? 404 : 400 });
  }
}
