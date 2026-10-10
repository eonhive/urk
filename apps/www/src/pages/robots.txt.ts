/**
 * Company: EonHive Inc.
 * Title: Website Robots Route
 * Purpose: Generate crawler guidance and the canonical sitemap with the static site.
 * Author: Stan Nesi
 * Created: 2026-10-10
 * Updated: 2026-10-10
 * Notes: Vibe coded with Codex.
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('Configure the website site URL before building robots.txt.');
  const sitemap = new URL('sitemap-index.xml', site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
