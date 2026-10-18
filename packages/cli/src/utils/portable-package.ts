/**
 * Company: EonHive Inc. | Title: Portable Package Archives
 * Purpose: Package compiled websites and validate ZIP contents before inspection or extraction.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, rmdir, type FileHandle } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Reader, Writer, ZipReader, ZipWriter, Uint8ArrayReader, type Entry, type FileEntry } from '@zip.js/zip.js';

export const PACKAGE_LIMITS = Object.freeze({
  archive: 256 * 1024 * 1024,
  total: 512 * 1024 * 1024,
  file: 128 * 1024 * 1024,
  entries: 10_000,
  manifest: 16 * 1024,
});

export type PackageManifest = {
  formatVersion: 1;
  name: string;
  version: string;
  type: string;
  entrypoint: 'index.html';
};

type PackageReport = { manifest: PackageManifest; files: number; compressed: number; expanded: number };
type SourceFile = { name: string; path: string; size: number };

function checkSize(size: number, limit: number, label: string): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > limit) {
    throw new Error(`${label} exceeds the ${limit} byte limit or has an invalid size.`);
  }
}

export function validateManifest(value: unknown): PackageManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('urk.json must contain an object.');
  const data = value as Record<string, unknown>;
  if (data.formatVersion !== 1) throw new Error('Unsupported or missing urk.json formatVersion; only version 1 is supported.');
  for (const field of ['name', 'version'] as const) {
    const text = data[field];
    if (typeof text !== 'string' || !text.trim() || text.length > 128 || /[\x00-\x1f\x7f]/.test(text)) {
      throw new Error(`Manifest ${field} must be a nonempty string of at most 128 characters without control characters.`);
    }
  }
  if (typeof data.type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(data.type)) {
    throw new Error('Manifest type must be a lowercase metadata token of at most 64 characters.');
  }
  if (data.entrypoint !== 'index.html') throw new Error('Package format 1 requires entrypoint "index.html".');
  return { formatVersion: 1, name: data.name as string, version: data.version as string, type: data.type, entrypoint: 'index.html' };
}

function validateName(name: string, directory: boolean): string {
  const path = directory && name.endsWith('/') ? name.slice(0, -1) : name;
  if (!path || Buffer.byteLength(path) > 1024 || /[\\\x00-\x1f\x7f<>:"|?*]/.test(path)) {
    throw new Error(`Unsafe package path: ${JSON.stringify(name)}`);
  }
  for (const part of path.split('/')) {
    if (!part || part === '.' || part === '..' || /[. ]$/.test(part) || Buffer.byteLength(part) > 255 ||
        /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part)) {
      throw new Error(`Unsafe package path: ${JSON.stringify(name)}`);
    }
  }
  return path;
}

// Compare implicit directories too: A/x and a/y collide on common hosting filesystems.
function pathRegistry() {
  const paths = new Map<string, { path: string; directory: boolean; explicit: boolean }>();
  return (name: string, directory: boolean) => {
    const path = validateName(name, directory);
    const parts = path.split('/');
    for (let index = 1; index <= parts.length; index++) {
      const prefix = parts.slice(0, index).join('/');
      const explicit = index === parts.length;
      const isDirectory = !explicit || directory;
      const key = prefix.normalize('NFC').toLowerCase();
      const prior = paths.get(key);
      if (prior && (prior.path !== prefix || prior.directory !== isDirectory || (prior.explicit && explicit))) {
        throw new Error(`Duplicate or conflicting package path: ${name}`);
      }
      paths.set(key, { path: prefix, directory: isDirectory, explicit: explicit || Boolean(prior?.explicit) });
    }
  };
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

async function inspectPath(path: string) {
  try { return await lstat(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function checkDestination(path: string, directory: boolean, overwrite = false): Promise<void> {
  if (contains(path, await realpath(process.cwd()))) throw new Error('Output must not be the working directory or its ancestor.');
  for (let part = path; ; part = dirname(part)) {
    if ((await inspectPath(part))?.isSymbolicLink()) throw new Error(`Output must not traverse a symlink: ${part}`);
    if (['.git', 'node_modules'].includes(basename(part))) throw new Error('Output must not be inside .git or node_modules.');
    if (dirname(part) === part) break;
  }
  const existing = await inspectPath(path);
  if (!existing) return;
  if (directory) {
    if (!existing.isDirectory() || (await readdir(path)).length) throw new Error(`Unpack output must be an absent or empty directory: ${path}`);
  } else if (!existing.isFile() || !overwrite) {
    throw new Error(`Package output already exists: ${path}. Use --overwrite to replace a regular archive file.`);
  }
}

class DiskReader extends Reader<FileHandle> {
  constructor(private readonly file: FileHandle, size: number) { super(file); this.size = size; }
  async readUint8Array(index: number, length: number): Promise<Uint8Array> {
    const buffer = Buffer.alloc(Math.min(length, Math.max(0, this.size - index)));
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await this.file.read(buffer, offset, buffer.length - offset, index + offset);
      if (!bytesRead) throw new Error('File was truncated while reading.');
      offset += bytesRead;
    }
    return buffer;
  }
}

class LimitedWriter extends Writer<void> {
  written = 0;
  constructor(private readonly limit: number, private readonly consume: (chunk: Uint8Array) => Promise<void>) { super(); }
  async writeUint8Array(chunk: Uint8Array): Promise<void> {
    this.written += chunk.length;
    checkSize(this.written, this.limit, 'Streamed data');
    await this.consume(chunk);
  }
  async getData(): Promise<void> {}
}

async function writeChunk(file: FileHandle, chunk: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < chunk.length) {
    const { bytesWritten } = await file.write(chunk, offset, chunk.length - offset);
    if (!bytesWritten) throw new Error('Could not write package output.');
    offset += bytesWritten;
  }
}

function validateHtml(html: string, files: Set<string>): void {
  const invalid = (url: string) => new Error(`Entrypoint asset is not portable: ${url}. Run urk export --base ./ before packing.`);
  const tags = html.replace(/<!--[\s\S]*?-->/g, '').match(/<(?:script|link|base)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi) ?? [];
  let base = new URL('https://urk.invalid/');
  for (const tag of tags) {
    if (!/^<base\b/i.test(tag)) continue;
    const value = htmlAttributes(tag).get('href');
    if (value && value !== './' && value !== '.') throw invalid(value);
    base = new URL(value || './', base);
  }
  for (const tag of tags) {
    const attributes = htmlAttributes(tag);
    const script = /^<script\b/i.test(tag);
    const resource = /^<link\b/i.test(tag) && /\b(stylesheet|modulepreload|preload|icon)\b/i.test(attributes.get('rel') ?? '');
    if (!script && !resource) continue;
    const value = attributes.get(script ? 'src' : 'href');
    if (value === undefined) continue;
    // Exported Vite URLs are plain relative paths. Reject ambiguous encoded HTML paths rather than rewriting them.
    if (!value || /^[\s/\\]/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value) || /[&\x00-\x20]/.test(value.split(/[?#]/)[0])) throw invalid(value);
    const url = new URL(value, base);
    let path: string;
    try {
      // Check before URL normalization, which would hide ../ references escaping a hosting subpath.
      const local = decodeURIComponent(value.split(/[?#]/)[0]).replace(/^(\.\/)+/, '');
      validateName(local, false);
      path = decodeURIComponent(url.pathname.slice(1));
    } catch { throw invalid(value); }
    if (url.origin !== base.origin || /\.(tsx?|jsx)$/i.test(path) || /(?:^|\/)(?:@vite|@fs|node_modules)(?:\/|$)/.test(path)) throw invalid(value);
    validateName(path, false);
    if (!files.has(path)) throw new Error(`Entrypoint asset is missing: ${path}. Run urk export --base ./ before packing.`);
  }
}

function htmlAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4]);
  }
  return attributes;
}

function validateEntry(entry: Entry): void {
  const mode = (entry.unixMode ?? (entry.externalFileAttributes >>> 16)) & 0o170000;
  const expectedMode = entry.directory ? 0o040000 : 0o100000;
  if (entry.symlink || (mode !== 0 && mode !== expectedMode)) throw new Error(`Links and special files are not supported: ${entry.filename}`);
  if (entry.encrypted) throw new Error(`Encrypted ZIP entries are not supported: ${entry.filename}`);
  if (entry.diskNumberStart !== 0 || ![0, 8].includes(entry.compressionMethod)) throw new Error(`Unsupported ZIP compression or split archive: ${entry.filename}`);
  checkSize(entry.compressedSize, PACKAGE_LIMITS.archive, entry.filename);
  checkSize(entry.uncompressedSize, entry.filename === 'urk.json' ? PACKAGE_LIMITS.manifest : PACKAGE_LIMITS.file, entry.filename);
  if (entry.directory && entry.uncompressedSize !== 0) throw new Error(`Directory contains file data: ${entry.filename}`);
}

async function readEntry(entry: FileEntry, output: string | undefined, total: { bytes: number }): Promise<Buffer | undefined> {
  const capture = entry.filename === 'urk.json' || entry.filename === 'index.html';
  const chunks: Buffer[] = [];
  let file: FileHandle | undefined;
  try {
    if (output) {
      const path = join(output, entry.filename);
      await mkdir(dirname(path), { recursive: true });
      file = await open(path, 'wx', 0o644);
    }
    const writer = new LimitedWriter(entry.uncompressedSize, async chunk => {
      total.bytes += chunk.length;
      checkSize(total.bytes, PACKAGE_LIMITS.total, 'Expanded package');
      if (capture) chunks.push(Buffer.from(chunk));
      if (file) await writeChunk(file, chunk);
    });
    await entry.getData(writer);
    if (writer.written !== entry.uncompressedSize) throw new Error('Uncompressed size does not match ZIP metadata.');
    return capture ? Buffer.concat(chunks) : undefined;
  } catch (error) {
    throw new Error(`Invalid package entry ${entry.filename}: ${error instanceof Error ? error.message : String(error)}`);
  } finally { await file?.close(); }
}

export async function inspectPackage(path: string, output?: string): Promise<PackageReport> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const disk = new DiskReader(file, 0);
  const reader = new ZipReader(disk, {
    strictness: 'strict', checkCrc32: true, checkOverlappingEntry: true, useWebWorkers: false,
  });
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new Error('Package must be a regular file.');
    checkSize(info.size, PACKAGE_LIMITS.archive, 'Archive');
    // Set the file-backed reader size before ZIP parsing starts.
    disk.size = info.size;
    const entries: Entry[] = [];
    const register = pathRegistry();
    let expanded = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      if (entries.length === PACKAGE_LIMITS.entries) throw new Error(`Package exceeds the ${PACKAGE_LIMITS.entries} entry limit.`);
      validateEntry(entry);
      register(entry.filename, entry.directory);
      expanded += entry.uncompressedSize;
      checkSize(expanded, PACKAGE_LIMITS.total, 'Expanded package');
      entries.push(entry);
    }
    const files = entries.filter((entry): entry is FileEntry => !entry.directory);
    const manifestEntry = files.find(entry => entry.filename === 'urk.json');
    if (!manifestEntry || !files.some(entry => entry.filename === 'index.html')) throw new Error('Package requires regular urk.json and index.html files.');
    const total = { bytes: 0 };
    const manifestBytes = (await readEntry(manifestEntry, output, total))!;
    const manifest = validateManifest(JSON.parse(manifestBytes.toString('utf8')));
    for (const entry of entries) {
      if (entry.directory) {
        if (output) await mkdir(join(output, entry.filename), { recursive: true });
      } else if (entry !== manifestEntry) {
        const bytes = await readEntry(entry, output, total);
        if (entry.filename === 'index.html') validateHtml(bytes!.toString('utf8'), new Set(files.map(item => item.filename)));
      }
    }
    return { manifest, files: files.length, compressed: info.size, expanded: total.bytes };
  } catch (error) {
    throw new Error(`Invalid .urkpkg ${path}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await reader.close();
    await file.close();
  }
}

async function collectSource(root: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  const register = pathRegistry();
  register('urk.json', false);
  let entries = 1;
  let total = 0;
  async function visit(directory: string, prefix: string): Promise<void> {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name);
      const info = await lstat(path);
      if (!info.isDirectory() && !info.isFile()) throw new Error(`Only regular files and directories can be packed: ${path}`);
      const relativeName = prefix + name;
      if (++entries > PACKAGE_LIMITS.entries) throw new Error(`Package exceeds the ${PACKAGE_LIMITS.entries} entry limit.`);
      if (relativeName.toLowerCase() === 'urk.json') throw new Error('urk.json is reserved for generated package metadata.');
      register(relativeName, info.isDirectory());
      if (info.isDirectory()) await visit(path, `${relativeName}/`);
      else {
        checkSize(info.size, PACKAGE_LIMITS.file, relativeName);
        total += info.size;
        checkSize(total, PACKAGE_LIMITS.total, 'Expanded package');
        files.push({ name: relativeName, path, size: info.size });
      }
    }
  }
  await visit(root, '');
  if (!files.some(file => file.name === 'index.html')) throw new Error('Pack requires an exported index.html. Run urk export --base ./ first.');
  return files;
}

async function publishArchive(staged: string, output: string): Promise<void> {
  const backup = `${staged}-previous`;
  const exists = Boolean(await inspectPath(output));
  if (exists) await rename(output, backup);
  try { await rename(staged, output); }
  catch (error) {
    if (exists) {
      try { await rename(backup, output); }
      catch { throw new Error(`Could not restore previous archive; it remains at ${backup}. ${String(error)}`); }
    }
    throw error;
  }
  if (exists) await rm(backup);
}

export async function packWebsite(input: string, output: string, metadata: PackageManifest, overwrite: boolean): Promise<void> {
  const manifest = validateManifest(metadata);
  if (!(await lstat(input)).isDirectory()) throw new Error('Pack input must be a regular directory containing exported web files.');
  const root = await realpath(input);
  if (contains(root, output) || contains(output, root)) throw new Error('Package output must be outside the input directory.');
  await checkDestination(output, false, overwrite);
  const files = await collectSource(root);
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  checkSize(manifestBytes.length, PACKAGE_LIMITS.manifest, 'Manifest');
  checkSize(files.reduce((total, file) => total + file.size, manifestBytes.length), PACKAGE_LIMITS.total, 'Expanded package');
  await mkdir(dirname(output), { recursive: true });
  const temporary = await mkdtemp(join(dirname(output), '.urk-pack-'));
  const staged = join(temporary, 'archive.urkpkg');
  try {
    const file = await open(staged, 'wx', 0o644);
    try {
      const writer = new ZipWriter(new LimitedWriter(PACKAGE_LIMITS.archive, chunk => writeChunk(file, chunk)), {
        useWebWorkers: false, level: 6, unixMode: 0o100644,
      });
      await writer.add('urk.json', new Uint8ArrayReader(manifestBytes));
      for (const source of files) {
        const handle = await open(source.path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const info = await handle.stat();
          if (!info.isFile() || info.size !== source.size) throw new Error(`Source changed during packaging: ${source.path}`);
          await writer.add(source.name, new DiskReader(handle, source.size));
        } finally { await handle.close(); }
      }
      await writer.close();
    } finally { await file.close(); }
    // Use exactly the same acceptance rules as inspect and unpack before publishing.
    await inspectPackage(staged);
    await checkDestination(output, false, overwrite);
    await publishArchive(staged, output);
  } finally {
    // A failed rollback is deliberately preserved for recovery.
    if (!(await inspectPath(`${staged}-previous`))) await rm(temporary, { recursive: true, force: true });
  }
}

export async function unpackPackage(input: string, output: string): Promise<PackageReport> {
  if (contains(output, resolve(input))) throw new Error('Unpack output must not contain the source archive.');
  await checkDestination(output, true);
  await mkdir(dirname(output), { recursive: true });
  const temporary = await mkdtemp(join(dirname(output), '.urk-unpack-'));
  try {
    const report = await inspectPackage(input, temporary);
    await checkDestination(output, true);
    // Removing an empty destination also permits rename on Windows; no existing files are replaced.
    if (await inspectPath(output)) await rmdir(output);
    await rename(temporary, output);
    return report;
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export function parsePackageArguments(args: string[], valueFlags: string[], allowOverwrite = false) {
  let directory: string | undefined;
  let overwrite = false;
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--overwrite' && allowOverwrite) { overwrite = true; continue; }
    if (arg.startsWith('-')) {
      const equal = arg.indexOf('=');
      const flag = equal < 0 ? arg : arg.slice(0, equal);
      if (!valueFlags.includes(flag)) throw new Error(`Unknown option: ${flag}`);
      const value = equal < 0 ? args[++index] : arg.slice(equal + 1);
      if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value.`);
      if (values[flag] !== undefined) throw new Error(`Duplicate option: ${flag}`);
      values[flag] = value;
    } else {
      if (directory !== undefined) throw new Error('Expected only one input path.');
      directory = arg;
    }
  }
  return { directory, overwrite, values };
}
