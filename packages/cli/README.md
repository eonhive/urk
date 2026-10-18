# `@urk/cli`

`@urk/cli` is the early developer tooling package for URK.

CLI means **Command-Line Interface**.

The package exists to help developers scaffold, export, package, generate embeds, inspect, and statically validate URK projects. It
does **not** own runtime behavior, browser mounting, adapter execution, controller orchestration,
or any other kernel responsibility.

## What it is

- developer tooling for URK projects and repo-only proofs
- source-based scaffolding and mutation
- static project checking and static project inspection
- production static web export through the existing Vite toolchain
- plain Node-based tooling with minimal dependencies

## What it is not

- not runtime architecture
- not a browser runtime
- not a framework shell
- not product logic
- not Kivatar logic
- not a live runtime inspector server

## Monorepo usage

Build the CLI inside the URK monorepo:

```bash
node scripts/build.mjs @urk/cli
```

Run it from the built entrypoint:

```bash
node packages/cli/dist/index.js --help
```

The repository build runner also builds `@urk/player`, whose compiled browser
module is copied by `urk embed`. The installed CLI resolves it from its declared
package dependency; it does not need a repository checkout or import it into Node.

You can also run a specific command directly:

```bash
node packages/cli/dist/index.js inspect
```

## Commands

### `urk embed <experience-url>`

Generate a static host for an already-hosted, trusted web export:

```bash
urk embed https://experiences.example.com/demo/ --out-dir embed \
  --title "My experience" --height 640px --fullscreen
```

The output contains `index.html`, the existing compiled `urk-player.js`,
`plain-iframe.html`, and `HOSTING.txt`. Upload the whole directory to a static
host. Relative links work under hosting subpaths. Visitors need no Node or build
tools. Generation does not build/fetch the experience, execute project config,
check URL availability, or deploy anything.

- The URL must be absolute HTTP(S), without embedded credentials. `.urkpkg`
  archives must be unpacked and hosted first.
- `--out-dir` defaults to `./embed`, resolved from the current working directory.
  It must be absent or empty; there is no overwrite option. Generation stages
  files before publishing. Symlink destinations/parents, working-directory
  ancestors, `.git`, and `node_modules` destinations are rejected.
- `--title` defaults to `uRK experience` (1–200 characters). HTML is escaped.
- `--height` defaults to `70vh`; accepts a positive `px`, `vh`, `dvh`, `svh`, or
  `rem` length. Both pages have responsive width and a 260px minimum height.
- `--fullscreen` enables fullscreen controls/permission where supported.
- `--check-src` enables the Player's optional CORS HEAD check. Omit it for static
  experience hosts without CORS support. The plain iframe has no HTTP check.

Serve the generated page from a **different origin** than the experience (a
different port/hostname, not just a different folder). The Player rejects a
same-origin URL at runtime; the plain iframe requires you to preserve this hosting
boundary. HTTPS host pages require HTTPS experiences. Trusted exports only;
do not redirect/navigate them onto the parent origin. Framing policy, audio
activation, and iframe load-detection limits remain as documented in the
[Player reference](../player/README.md). The generator adds no runtime or
privileged host bridge.

### `urk create <name>`

Scaffold a standalone browser-first URK app.

Example:

```bash
node packages/cli/dist/index.js create my-runtime
```

Creates a small app with:

- `src/kernel.ts`
- `src/main.ts`
- `src/adapters.ts`
- `src/contracts.ts`
- `src/controllers/app.controller.ts`
- `public/content.json`

The scaffold's normal `yarn build` runs TypeScript checking and Vite with
`base: './'`. Its `dist/` is directly hostable at a root or subpath and can be
passed unchanged to `urk pack`. No extra export step is required. See the
generated README for build → iframe → package → Player commands.

### `urk create-proof <name>`

Scaffold a repo-only proof route under `examples/`.

Example:

```bash
node packages/cli/dist/index.js create-proof loading-flow
```

This command is monorepo-only. It updates the private proof workspace routing files as part of the
scaffold.

### `urk export [directory]`

This existing optional command provides staged output/replacement for browser
projects. New standalone scaffolds already produce portable output with
`yarn build`; export is not a required stage in that workflow.

Export a browser experience with an `index.html` entrypoint. The CLI uses Vite 5,
loads the selected project's Vite configuration, and preserves its plugins and
aliases. Existing Core/adapters are bundled as application dependencies; no
separate runtime or player is introduced.

```bash
urk export
urk export ./my-experience --out-dir dist --base ./
urk export ./my-experience --overwrite
```

- Directory defaults to the current working directory. It does not search parent
  directories for a different HTML entrypoint.
- Output defaults to the selected project's `dist`. Relative `--out-dir` paths
  resolve from that project; absolute paths are also supported. Export controls
  the output location, including any configured Rollup `output.dir`.
- Base defaults to `./`, so the whole directory can move to a hosting subpath.
  Use `--base /games/my-experience/` when the hosting path is fixed.
- Nonempty output requires `--overwrite`. The build completes in temporary output
  before replacing the destination. Build failures preserve the previous export.
  Source/public directories, project roots/ancestors, and output symlinks are rejected.
- SSR/library builds, non-ES-module output, and external JavaScript module dependencies are rejected.
  Export transpiles TypeScript; use the existing project typecheck/build command
  separately to check types.

The result contains playable `index.html`, production JS/CSS, imported assets,
and copied `public/` files. Upload **the whole output directory** to a static HTTP
host. Visitors need only a browser; Node, Vite, TypeScript, and the CLI are authoring
tools. Opening the HTML using `file://` is not supported.

Import assets from source or reference them in CSS so Vite can rewrite their URLs.
For runtime access to `public/content.json`, use
`fetch(import.meta.env.BASE_URL + 'content.json')` from a root entrypoint, or
`fetch(new URL('content.json', document.baseURI))` when the file is alongside the
page, as in the generated starter. Export cannot rewrite arbitrary strings such
as `fetch('/content.json')`, download remote assets, or replace backend services.

Embed the hosted experience from an ordinary HTML website:

```html
<iframe title="My uRK experience" src="https://your-host.example/games/my-experience/"
  style="display:block;width:100%;height:85vh;border:0"></iframe>
```

The iframe provides its own document, input focus, and scrolling. No host JavaScript
or uRK installation is required. Use a host that permits framing, and use HTTPS
for the experience when the parent website uses HTTPS. Browser storage and media
permissions still follow the iframe origin and browser policy.

New `urk create` projects include the CLI as a development dependency and expose
`yarn export`. The unchanged Picking proof is the repository's export demo:

```bash
corepack yarn export:demo
python3 -m http.server 8080 --directory examples/picking/dist
# In another terminal:
python3 -m http.server 8081 --directory examples
```

Open `http://127.0.0.1:8081/portable-embed.html`. Re-export using
`corepack yarn export:demo --overwrite`. The Python servers are optional local
verification tools; any ordinary static HTTP host can serve these files.

### `urk pack`, `urk inspect <package.urkpkg>`, and `urk unpack`

Distribute an already-exported website as one ZIP-compatible `.urkpkg` file:

```bash
urk export --base ./
urk pack dist --out experience.urkpkg --name "My experience" --version 0.1.0 --type game
urk inspect experience.urkpkg
urk unpack experience.urkpkg --out-dir site
python3 -m http.server 8080 --directory site
```

Pack copies the compiled website bytes, including public assets. It does not build,
install dependencies, execute project configuration, or rewrite code. All paths
are relative to the current directory. Input defaults to `dist`; output defaults
to a sibling `<input-directory-name>.urkpkg`. Name defaults to the input directory
name, or its parent name for `dist`; version defaults to `0.1.0`, and type to
`experience`. Use `--overwrite` to replace an archive after successful validation.

The archive has `index.html` and assets at its root, alongside generated `urk.json`:

```json
{
  "formatVersion": 1,
  "name": "My experience",
  "version": "0.1.0",
  "type": "game",
  "entrypoint": "index.html"
}
```

Format version 1 requires `index.html`. Name/version are nonempty strings up to
128 characters without control characters; the experience version is metadata,
separate from format compatibility. Type is a lowercase token up to 64 characters
using letters, digits, and hyphens, starting with a letter. Games, apps, widgets,
visualizers, and custom types all use the same existing runtime. Root `urk.json`
is reserved: pack refuses an existing file or directory with that name.

Package inspection validates the manifest, paths, sizes, entrypoint references,
and file CRC checksums without extracting or executing content. Plain `urk inspect`
still inspects the current project. Unpack uses the same validation and publishes
from temporary storage only when everything passes. It defaults to a sibling
directory named after the archive without `.urkpkg`; its destination must be
absent or empty. There is no directory overwrite flag.

Limits are **256 MiB archive**, **512 MiB expanded**, **128 MiB per file**,
**10,000 entries**, and **16 KiB manifest**, with streamed byte counts checked too.
Only stored/deflated, unencrypted entries with safe relative names are accepted.
Links, special files, traversal, ambiguous/colliding paths, and symlink destinations
are rejected. Extracted files receive ordinary file permissions, not executable
or privileged ZIP permissions.

Use the relative-base Web Export output. Pack rejects missing or nonportable
entrypoint script/style references, including TypeScript, Vite development paths,
and root-relative URLs. Arbitrary URLs inside application code and remote services
remain application concerns; packaging is not an offline conversion or authenticity
check. Recipients can extract with the CLI or a compatible ZIP tool without rebuilding.
Browsers run the extracted website over HTTP, **not the archive itself**.

### `urk add adapter <name>`

Add one supported DOM adapter to `src/adapters.ts` in a standalone URK project.

Current supported names are defined by the CLI adapter catalog and include the DOM-first adapters
used by generated projects.

Use `ui-overlay` for the status/callout overlay; `ui-widgets` remains accepted.
Adding either alias when the other is already registered leaves the file unchanged.
Package checks and inspection recognize both the new React/Next names and their
published legacy names.

Example:

```bash
node packages/cli/dist/index.js add adapter pointer
```

### `urk create controller <name>`

Scaffold a controller file under `src/controllers/`.

Example:

```bash
node packages/cli/dist/index.js create controller loading-flow
```

The CLI writes the file and then prints the manual kernel wiring step. It does not silently change
the kernel controller array for you.

### `urk check`

Run static checks against the current project or repo surface.

The check command looks for:

- package declaration mismatches
- basic runtime boot shape
- wrapper-boundary issues
- product-boundary term leakage
- proof workspace structure rules

Example:

```bash
node packages/cli/dist/index.js check
```

### `urk inspect`

Run static project inspection for the nearest URK project.

The inspect command:

- locates the nearest `package.json`
- prints the project name
- reports detected URK packages
- scans `src`, `app`, and `examples`
- detects likely kernel files through `createKernel(...)`
- detects likely boot files through `.boot()`
- detects common adapter factories
- detects likely controller files

Example:

```bash
node packages/cli/dist/index.js inspect
```

Important limitation:

- static inspection only
- no browser connection
- no WebSocket server
- no HTTP server
- no live runtime state

Live runtime state still requires browser runtime integration.

## Boundary

`@urk/cli` is developer tooling only.

Keep these rules explicit:

- no Kivatar or other product logic
- no runtime logic ownership
- no framework-first architecture
- no CLI-to-core dependency inversion
- no live inspector transport in this package unless that is intentionally designed later

`@urk/core` remains the source of truth for runtime lifecycle, context, state, adapters,
controllers, registries, scheduler behavior, and inspection data structures.

## Examples

Scaffold a standalone app:

```bash
node packages/cli/dist/index.js create demo-app
```

Add an adapter:

```bash
cd demo-app
node /path/to/urk/packages/cli/dist/index.js add adapter loading
```

Scaffold a controller:

```bash
node /path/to/urk/packages/cli/dist/index.js create controller boot-flow
```

Run a static check:

```bash
node /path/to/urk/packages/cli/dist/index.js check
```

Run static inspection:

```bash
node /path/to/urk/packages/cli/dist/index.js inspect
```

## v0.2 scaffolds

New projects use v0.2 typed services, parallel adapter startup, scoped subscriptions, and awaited phase commands. Content loads from editable `public/content.json` with cancellation. The host includes pause, resume, stop, fresh-kernel recovery, and Vite hot-reload cleanup. Event-driven controllers have no update hook, so auto mode keeps the frame loop idle. Generated controller files likewise omit a placeholder update hook; add one only for real frame work. Node 22, Yarn, and existing commands remain supported.
