# URK Examples

This workspace is private and repo-only. It exists to make URK easy to understand, not to publish installable example packages.

## Run locally

```bash
corepack yarn workspace urk-examples dev
```

Or from the repo root:

```bash
corepack yarn dev
```

## Routes

- `/` - examples index
- `/motion-lab/` - controller-driven tweens, timelines, and three interruptible DOM views
- `/motion-widget/` - reusable DOM widgets with independent playback/ownership on one shared runtime
- `/motion-starter/` - a copy-and-embed host with an independent-project exporter; see `motion-starter/README.md`
- `/audio-proof/` - DOM-first audio transport proof
- `/picking/` - DOM plus Three picking proof
- `/loading-transition/` - staged loading and transition proof
- `/app-shell/` - DOM-first app shell orchestration proof
- `/react-starter/` - React wrapper proof
- `/scrollytelling/` - Story Flow: reversible scroll-driven timelines, selectable timed entrances, guided scrolling, and manual interruption
- `/runtime-inspector/` - runtime inspector proof

Each proof folder contains:

- `README.md` - what the proof demonstrates and how URK is used
- `index.html` - page shell
- `styles.css` - proof styling
- `main.ts` or `main.tsx` - proof logic

The standalone Next proof stays outside this workspace at `apps/next-proof`.

## Complete portable workflow with the normal build

From the repository root, run the ordered acceptance proof:

```bash
corepack yarn test:portable
```

It creates a fresh standalone project, installs packed local workspace packages
(these changes are not yet published), and runs its unchanged `yarn build` script:
`tsc --noEmit && vite build`. The scaffold's Vite config sets `base: './'`.
The proof verifies the build under a static HTTP subpath and in external HTML
before packaging it, inspecting the manifest, unpacking it, and opening the
manifest's entrypoint through the existing Player. No `urk export` is used.
It also checks pointer/keyboard controls, shutdown on navigation, byte-preserving
extraction, reload, and removal. Test projects are cleaned up; logs and a screenshot
are retained under `.codex/validation/player-browser/`.

In a created project with its dependencies installed, the authoring commands are:

```bash
corepack yarn build
corepack yarn urk embed http://127.0.0.1:8080/ --out-dir ../embed --fullscreen
corepack yarn urk pack dist --out ../experience.urkpkg --name "My experience" --type app
corepack yarn urk inspect ../experience.urkpkg
corepack yarn urk unpack ../experience.urkpkg --out-dir ../site
```

Serve `dist/` initially, or the extracted `../site/`, on port 8080. In a second
terminal serve `../embed/` on port 8081:

```bash
python3 -m http.server 8080 --directory ../site
python3 -m http.server 8081 --directory ../embed
```

Open the generated Player at `http://127.0.0.1:8081/`, or its
`plain-iframe.html` fallback. Keep trusted experiences on a different origin from
their host. Recipients run compiled HTML/JS/CSS/assets through HTTP, without Node,
TypeScript, Vite, or uRK tooling. Browsers do not execute the ZIP itself. Use new
or empty output directories when repeating generation/extraction.

The earlier `urk export` flow below remains available for compatibility and
staged replacement; it is optional for the standalone scaffold.

## Portable web export

Export the existing Picking proof from the repository root:

```bash
corepack yarn export:demo
```

This builds its existing workspace dependencies and runs `urk export examples/picking`.
The static distribution is `examples/picking/dist/`. Repeat with
`corepack yarn export:demo --overwrite` to replace an existing export after a
successful build. No Picking, Core, or adapter implementation changes are needed.

Serve the exported files and the separate plain HTML embed example in two terminals:

```bash
python3 -m http.server 8080 --directory examples/picking/dist
python3 -m http.server 8081 --directory examples
```

Open `http://127.0.0.1:8080/` directly, or
`http://127.0.0.1:8081/portable-embed.html` to interact across iframe origins.
Copy `portable-embed.html` to any website and replace its iframe `src` with the
deployed experience URL. Its width follows the host; tall content scrolls inside
the iframe. Visitors need only a browser.

The default relative base lets the whole export directory move under a hosting
subpath. For a fixed path, pass `--base /games/picking/`. Public files and imported
assets follow Vite's existing behavior; arbitrary root-relative runtime URLs and
remote services require application-owned configuration. See the
[CLI export reference](../packages/cli/README.md#urk-export-directory).

## Portable package round trip

From the repository root, export Picking, package it, and extract a hostable copy:

```bash
corepack yarn export:demo --overwrite
node packages/cli/dist/index.js pack examples/picking/dist --out .codex/portable/picking.urkpkg --name Picking --type game
node packages/cli/dist/index.js inspect .codex/portable/picking.urkpkg
node packages/cli/dist/index.js unpack .codex/portable/picking.urkpkg --out-dir .codex/portable/site
python3 -m http.server 8080 --directory .codex/portable/site
```

The result is a standard ZIP with a versioned `urk.json`, compiled HTML/JS/CSS,
and assets. Add `--overwrite` to repeat **pack**. For another **unpack**, select
a new or empty output directory. The existing `portable-embed.html` also works
with this extracted site on port 8080; serve the examples directory on port 8081
as above. The recipient extracts and hosts the files without rebuilding; a
browser does not execute the `.urkpkg` archive directly.

## Optional Web Player

```bash
corepack yarn demo:player
```

Open [the two-player page](http://127.0.0.1:8090/). The command builds the optional
`@urk/player` browser module, exports Picking, and serves the plain HTML host on
port 8090 and its compiled experience on port 8091. Each Player offers Play,
Reload, Unload, and optional Fullscreen. Remove/Restore demonstrates cleanup and
fresh loading without affecting the other Player. The page links to a plain
iframe fallback. Stop both local servers with Ctrl+C.

Copy `packages/player/dist/urk-player.js` and the HTML example to a static host,
then replace the experience URLs with your separately hosted export. This MVP
requires different origins and trusted experiences. `check-src` is optional and
requires CORS HEAD support; omit it for static hosts without CORS. No Node or
development server is needed by visitors. The Player does not execute archives.
See the [Player API and limitations](../packages/player/README.md).

`corepack yarn test:player` runs focused static HTTP export, package, and Player
browser checks without starting the React, Next, or website development hosts.

## Generate a static embed host

From the repository root:

```bash
corepack yarn export:demo --overwrite
node packages/cli/dist/index.js embed http://127.0.0.1:8080/ --out-dir .codex/portable/embed --title Picking --height 75vh --fullscreen
```

In separate terminals, serve the experience and generated host:

```bash
python3 -m http.server 8080 --directory examples/picking/dist
python3 -m http.server 8081 --directory .codex/portable/embed
```

Open [the generated Player](http://127.0.0.1:8081/), or its
[plain iframe fallback](http://127.0.0.1:8081/plain-iframe.html). The generated
directory includes the compiled Player and `HOSTING.txt`; it needs no development
server. For another generation, choose a new/empty output directory. Replace the
experience URL with its deployment URL for production, and keep the host on a
separate origin. Default generation needs no CORS configuration or network access.

- `/audio-starter/` - reusable Canvas audio widget and independent-project exporter; see `audio-starter/README.md`
