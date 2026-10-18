# uRK Player

Optional, browser-only Web Component for hosting **trusted exported experiences**.
It loads an existing static website in an iframe. The application inside still
owns its Core kernel, adapters, rendering, input, and audio. No runtime dependency
or changes to the experience's application code are needed.

## Try the demo

From the repository root, with Node 22 and Yarn available:

```sh
corepack yarn demo:player
```

Open [the two-player demo](http://127.0.0.1:8090/). Picking is exported into
`.codex/player/picking/` and served at `http://127.0.0.1:8091/picking/`.
The demo serves only built static files, with CORS enabled for optional URL checks.
Click a target and use arrow keys; try Reload, Unload, Play, and Remove/Restore on
either Player. The other keeps its own application state. Ctrl+C stops both servers.

Run the focused browser checks with `corepack yarn test:player`.

## Embed on an ordinary website

The CLI can generate the whole static host, including a copy of this module:

```sh
urk embed https://experiences.example.net/games/demo/ --out-dir embed \
  --title "My experience" --height 640px --fullscreen
```

Upload that directory to a separate-origin static host. Output must be absent or
empty. See the [CLI embed reference](../cli/README.md#urk-embed-experience-url).
For manual integration:

Build with `corepack yarn workspace @urk/player build`, copy
`packages/player/dist/urk-player.js` to your website, and load it as a module:

```html
<script type="module" src="/assets/urk-player.js"></script>
<urk-player
  src="https://experiences.example.net/games/demo/index.html"
  title="My experience"
  fullscreen
  style="--urk-player-height: 640px"
></urk-player>
```

Serve the hosting page from a **different origin**, such as
`https://www.example.com`. Scheme, hostname, and port determine an origin;
different folders alone do not. Local demos use different ports. Same-origin
sources are rejected, including relative URLs that resolve to the host origin.
HTTPS pages require HTTPS experiences. Use HTTP hosting, not `file://`.

Only the creator needs development tools. Visitors receive the compiled browser
module and the existing static experience. Bundled applications can alternatively
`import '@urk/player'` in browser code; do not import it during server rendering.
This repository adds the package; publication to a registry is a separate step.

| API | Behavior |
| --- | --- |
| `src` attribute/property | HTTP(S) HTML URL. Setting or changing it loads a fresh iframe; removing it unloads. |
| `title` | Accessible iframe title. |
| `fullscreen` | Boolean attribute enabling fullscreen controls and iframe permission, where supported. |
| `check-src` | Optional CORS HEAD check before navigation; rejects HTTP errors and non-HTML responses. |
| `play()` | Load an unloaded source, or focus the existing loaded iframe. |
| `reload()` | Discard the current iframe and load a fresh document. |
| `unload()` | Remove the iframe and cancel pending host work; keep `src` for another Play. |
| `state` | Read-only `idle`, `loading`, `loaded`, or `error`. Also exposed as `data-state`. |
| `urk-player-statechange` | Bubbling event with `detail: { state, src, message }`. |

Width follows the containing element; default height is `70vh` with a 260px
minimum. Set `--urk-player-height` or style the element's height directly. Tall
experiences scroll natively inside the iframe. Shadow parts `controls`, `stage`,
`frame`, and `status` allow host styling. No automatic iframe height messaging.

## Loading, input, and cleanup

`loaded` means the iframe emitted a navigation load event. It does **not** certify
application startup. Browsers do not reliably report iframe HTTP errors, blocked
framing, or application exceptions to a separate-origin parent. Invalid URLs and
15-second loading timeouts report errors. For HTTP diagnostics, add `check-src`
and configure the experience host to accept HEAD requests with a suitable
`Access-Control-Allow-Origin` header and HTML `Content-Type`. Without `check-src`,
CORS is unnecessary for normal iframe navigation. The experience host must still
allow embedding through its CSP `frame-ancestors` and `X-Frame-Options` policy.

Keyboard focus, mouse, touch, pointer lock, and media stay with the embedded app
and browser. Click inside the experience for input/audio activation. The Play
button cannot bypass browser autoplay restrictions or invoke app-specific play,
pause, or audio controls. A paused application keeps its own Resume control.
Fullscreen availability depends on the browser and any containing iframe's policy.

Removal, unload, and reload discard the iframe browsing context, abort an optional
HTTP check, cancel the loading timer, and release host references. Removal also
removes the document fullscreen listener. Reconnecting the element loads afresh.
This does not invoke or await the application's asynchronous kernel shutdown;
there is no runtime/lifecycle bridge. Browser-managed persistent data and service
workers are not erased. Players have separate documents and runtime instances;
experiences using the same origin can still share cookies/local storage.

## Trust boundary and plain iframe fallback

This MVP supports trusted local or hosted exports. The iframe uses
`allow-scripts allow-same-origin allow-pointer-lock allow-forms`; its separate
origin prevents reading the parent document. Camera, microphone, and geolocation
are disabled; there is no parent API, file picker, or native filesystem bridge.
Top navigation, popups, and downloads are not granted. Do not redirect or navigate
an experience onto the hosting page's origin: preserving an experience's origin
is for compatibility and is **not containment for malicious applications**.
Untrusted packages, origin provisioning, signing, and marketplace isolation are
outside this MVP. A future untrusted mode needs a separately controlled origin
and stricter hosting policy; the current component exposes no privileged bridge.

For websites that cannot load the component, use the same separate-origin policy:

```html
<iframe
  src="https://experiences.example.net/games/demo/index.html"
  title="My experience"
  sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
  allow="autoplay 'src'; fullscreen 'src'; camera 'none'; microphone 'none'; geolocation 'none'"
  allowfullscreen referrerpolicy="no-referrer"
  style="width:100%;height:75vh;min-height:260px;border:0"
></iframe>
```

See `examples/player/plain-iframe.html`. `.urkpkg` archives must first be unpacked
and their extracted website hosted over HTTP. No browser-side ZIP mounting is
implemented.
