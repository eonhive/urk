/**
 * Company: EonHive Inc.
 * Title: Public Website Smoke Check
 * Purpose: Verify local or deployed URK website routes, sitemap, 404 handling, and critical assets.
 * Author: Stan Nesi
 * Created: 2026-06-05
 * Updated: 2026-10-10
 * Notes: Vibe coded with Codex.
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { local: { type: 'boolean', default: false } } });
const DEFAULT_SITE_URL = values.local ? 'http://localhost:4321' : 'https://urk.eonhive.com';
const REQUEST_TIMEOUT_MS = 15000;

const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? DEFAULT_SITE_URL);

const routeChecks = [
  {
    path: '/',
    expectedStatus: 200,
    includes: ['public open-source runtime kernel', 'URK'],
  },
  {
    path: '/docs/',
    expectedStatus: 200,
    includes: ['URK Docs'],
  },
  {
    path: '/examples/minimal-runtime/',
    expectedStatus: 200,
    includes: ['data-example-id="minimal-runtime"', 'Minimal Runtime'],
  },
  {
    path: '/packages/',
    expectedStatus: 200,
    includes: ['Packages', '@urk/core'],
  },
  {
    path: '/playground/',
    expectedStatus: 200,
    includes: ['Playground', 'urk-playground'],
  },
  {
    path: '/v02/',
    expectedStatus: 200,
    includes: ['URK v0.2', 'urk-playground'],
  },
  {
    path: '/playground/config/',
    expectedStatus: 200,
    includes: ['Playground config', 'known-example'],
  },
  {
    path: '/sitemap-index.xml',
    expectedStatus: 200,
    includes: ['sitemap-0.xml'],
  },
  {
    path: '/sitemap-0.xml',
    expectedStatus: 200,
    includes: [siteUrl],
  },
  {
    path: '/robots.txt',
    expectedStatus: 200,
    includes: ['User-agent: *', `Sitemap: ${siteUrl}/sitemap-index.xml`],
  },
  {
    path: '/definitely-missing-urk-smoke-test/',
    expectedStatus: 404,
    includes: ['404'],
  },
];

const criticalAssetPatterns = [
  /^\/favicon\.svg$/,
  /^\/_astro\/.+\.css$/,
  /^\/_astro\/.+\.js$/,
  /^\/brand\/.+\.(?:svg|png|jpg|jpeg|webp|avif)$/,
];

const results = [];

try {
  const pages = new Map();

  for (const check of routeChecks) {
    const response = await fetchText(check.path);
    assertStatus(check.path, response.status, check.expectedStatus);
    assertIncludes(check.path, response.body, check.includes);
    pages.set(check.path, response.body);
    results.push(`ok ${check.expectedStatus} ${check.path}`);
  }

  const homeHtml = pages.get('/');
  const assetPaths = collectAssetPaths(homeHtml);
  const criticalAssetPaths = assetPaths.filter((path) =>
    criticalAssetPatterns.some((pattern) => pattern.test(path)),
  );

  if (criticalAssetPaths.length === 0) {
    throw new Error('No critical local assets were found on the home page');
  }

  for (const assetPath of criticalAssetPaths) {
    const response = await fetchBytes(assetPath);
    assertStatus(assetPath, response.status, 200);
    results.push(`ok asset ${assetPath} (${response.size} bytes)`);
  }

  const mode = values.local ? 'local static output' : 'deployed site';
  console.log(`URK website smoke passed (${mode}): ${siteUrl}`);
  for (const result of results) {
    console.log(`- ${result}`);
  }
} catch (error) {
  console.error(`URK website smoke failed: ${siteUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function normalizeSiteUrl(value) {
  const parsedUrl = new URL(value);
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
  parsedUrl.search = '';
  parsedUrl.hash = '';
  return parsedUrl.toString().replace(/\/$/, '');
}

async function fetchText(path) {
  const response = await fetchWithTimeout(toUrl(path));
  const body = await response.text();
  return {
    status: response.status,
    body,
  };
}

async function fetchBytes(path) {
  const response = await fetchWithTimeout(toUrl(path));
  const body = await response.arrayBuffer();
  return {
    status: response.status,
    size: body.byteLength,
  };
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        'user-agent': 'urk-smoke-www/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function toUrl(path) {
  return new URL(path, `${siteUrl}/`).toString();
}

function assertStatus(path, actualStatus, expectedStatus) {
  if (actualStatus !== expectedStatus) {
    throw new Error(`${path} returned HTTP ${actualStatus}; expected ${expectedStatus}`);
  }
}

function assertIncludes(path, body, markers) {
  for (const marker of markers) {
    if (!body.includes(marker)) {
      throw new Error(`${path} did not include expected marker: ${marker}`);
    }
  }
}

function collectAssetPaths(html) {
  const paths = new Set();
  const attributePattern = /\b(?:href|src)="([^"]+)"/g;
  let match = attributePattern.exec(html);

  while (match) {
    const value = match[1];
    if (value.startsWith('/')) {
      paths.add(value);
    }
    match = attributePattern.exec(html);
  }

  return [...paths];
}
