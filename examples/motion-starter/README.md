# Motion Embed Starter

A small browser host for the reusable motion widget: ordinary HTML/CSS,
one kernel, one motion adapter, and one controller. The page owns runtime
pause/resume, disposal, and fresh-kernel restart. The widget supplies replay,
scrubbing, timing/speed controls, reduced motion, and JSON presets. Optional
settings memory stays off until the user enables it.

## Generate an independent project from this checkout

Use Node 22 and Yarn 3.8.7. From the URK repository root:

```bash
node scripts/build.mjs @urk/adapters
node scripts/create-motion-starter.mjs /tmp/my-motion-widget
cd /tmp/my-motion-widget
corepack yarn install
corepack yarn dev
```

Choose a new destination; the exporter refuses to overwrite existing paths.
It copies the canonical widget source and packs the current Core/adapters builds
into `vendor/`. Generated dependencies use relative file paths, so you can move
the whole project before installation. It does not require unpublished npm
versions, the private `@urk/examples` package, repo aliases, or a new URK package.
Archive names include content digests so same-version exports cannot reuse stale
local packages from Yarn's cache.
TypeScript/Vite install through Yarn as in the existing standalone scaffold.

In a generated project, run these commands directly:

```bash
corepack yarn install
corepack yarn dev
```

Open `http://127.0.0.1:5173/` (Vite prints another port if that one is occupied).

## Adapt to your page

- `index.html` owns the host caption, controls, and `#motion-host` container.
- `main.ts` registers the adapter and mounts the widget during controller start.
  Change the title/tone there. Keep the lifecycle code when adding it to a page.
- `widget/` contains the copied shared implementation and its scoped styles.
  Its runtime imports are only `@urk/core` and `@urk/adapters/motion`.
- Change `my-site:motion-widget` to a stable, unique storage key for your host.
  Remove the preferences helper and its restore/change wiring to omit saving.
- If your page already owns a kernel, register one motion adapter and call
  `mountMotionWidget(host, ctx, options)` in its controller. Do not create an
  additional kernel or frame loop just for this widget.

The host container and original caption remain borrowed. Disposal removes widget
and preference controls through their scopes; restart mounts them using a new
kernel. Page exit and development hot replacement shut down the current kernel.
The widget automatically follows system reduced motion and suspends offscreen.
Native buttons, labels, and focus indicators support keyboard operation.

## Build and embed

```bash
corepack yarn build
python3 -m http.server 8080 --directory dist
```

Deploy the entire `dist/` directory. Its relative asset paths work at a hosting
root or subdirectory; visitors need only a browser. Run it through HTTP rather
than opening files directly. Embed the hosted page in existing HTML:

```html
<iframe
  title="Motion widget"
  src="https://your-site.example/widgets/motion/"
  width="100%"
  height="1200"
  style="border: 0"
></iframe>
```

Choose the frame height for your page, or allow its normal scrolling when the
settings panels expand. There is no automatic iframe resize or cross-frame API.

## Repository preview

The source preview is `/motion-starter/` on the existing examples Vite server.
Its tiny `widget/index.ts` bridge reuses the canonical example. The exporter
replaces that bridge with the actual source; generated projects have no private
package dependency. Canonical source remains in `packages/examples/src/motion-widget/`.
