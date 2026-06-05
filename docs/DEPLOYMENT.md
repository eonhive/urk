# Deployment

## Default target

Use Cloudflare Workers Static Assets for the public URK website when deploying through the current Cloudflare Workers dashboard flow. `apps/www` is a static Astro/Starlight site, but it consumes internal workspace packages from the monorepo, so deploy builds must run from the repository root.

Do not build `@urk/examples` first by itself in a clean deploy environment. It reads declaration output from `@urk/core` and `@urk/adapters`, so those packages must be built first.

## Cloudflare Workers Static Assets

The Workers dashboard does not show a `Build output directory` text field. In the Workers static-assets model, `wrangler.jsonc` provides that path through `assets.directory`.

Repo config:

```jsonc
{
  "name": "urk-site",
  "compatibility_date": "2026-06-05",
  "assets": {
    "directory": "./apps/www/dist",
    "not_found_handling": "404-page"
  }
}
```

Do not add `main` or `assets.binding` for the current URK site. This is an assets-only Worker, not a Worker script plus assets.

Cloudflare Workers Build settings:

- Production branch: `main`
- Root directory: repository root
- Build command: `corepack enable && SITE_URL=https://urk.eonhive.com corepack yarn build:www`
- Deploy command: `npx wrangler deploy --keep-vars`
- Version command: `npx wrangler versions upload --keep-vars`
- Environment variables: `NODE_VERSION=22`, `YARN_VERSION=3.8.7`

The Worker name in Cloudflare must match `name` in `wrangler.jsonc`. The current configured name is `urk-site`.

If you deploy manually with Wrangler, build first and then deploy the generated assets:

```bash
SITE_URL=https://urk.eonhive.com corepack yarn build:www
npx wrangler deploy --keep-vars
```

## Cloudflare Pages

Cloudflare Pages also works, but it is no longer the only recommended path now that Workers Static Assets supports static sites directly.

Cloudflare Pages settings:

- Project type: Pages application with Git integration
- Production branch: `main`
- Root directory: repository root
- Build command: `corepack enable && SITE_URL=https://urk.eonhive.com corepack yarn build:www`
- Build output directory: `apps/www/dist`
- Environment variables: `NODE_VERSION=22`, `YARN_VERSION=3.8.7`

Cloudflare Pages documentation describes the build command as the command Pages runs to create the static output, and the build output directory as the directory Pages uploads. Cloudflare also supports monorepos by varying the root directory and build command. URK keeps root directory at the repository root because workspace dependencies are needed during the build.

## Netlify

Netlify settings:

- Base directory: repository root
- Build command: `corepack enable && SITE_URL=$DEPLOY_PRIME_URL corepack yarn build:www`
- Publish directory: `apps/www/dist`
- Environment variables: `NODE_VERSION=22`, `YARN_VERSION=3.8.7`

Keep the base directory at the repository root. Setting the base directory to `apps/www` hides the internal workspace packages from the build.

## Vercel

Vercel can host the static Astro output, but it is not the default recommendation for URK.

Recommended settings if used:

- Root directory: repository root
- Build command: `corepack enable && SITE_URL=https://$VERCEL_URL corepack yarn build:www`
- Output directory: `apps/www/dist`
- Environment variables: `NODE_VERSION=22`

Use a production domain value for `SITE_URL` after the final domain is known so sitemap URLs are stable.

## GitHub Pages

GitHub Pages is acceptable as a fallback or mirror, not the preferred launch target. Use GitHub Actions from the repository root with Node 22, Corepack, `corepack yarn install --immutable`, `SITE_URL=https://<owner>.github.io/<repo> corepack yarn build:www`, and upload `apps/www/dist` as the Pages artifact.

## Local deploy-build check

Use this before changing provider settings:

```bash
rm -rf packages/core/dist packages/adapters/dist packages/examples/dist apps/www/dist
SITE_URL=https://example.com corepack yarn build:www
```

The command should rebuild package artifacts in dependency order and produce `apps/www/dist`.
