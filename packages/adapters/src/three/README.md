# Three Adapter

Provides a small Three.js scene surface behind a URK capability contract.

## Requires

- `three:host` `HTMLElement` service

## Exposes

- `getHost()`
- `getCanvas()`
- `getScene()`
- `getCamera()`
- `getRenderer()`
- `getSize()`
- `resize()`
- `render()`
- `raycast(...)`

## Resizing and demand rendering

The adapter sizes the renderer and camera from its borrowed host. A changed size
or pixel ratio emits `three:resize` with a `ThreeResizeEventPayload` containing
`host`, `width`, `height`, and `pixelRatio`. Controllers can filter by host and
request a redraw. The adapter does not start a render loop. Calling `resize()`
with unchanged dimensions and pixel ratio does not clear the drawing buffer.

Host dimensions are observed with `ResizeObserver` (window resize is the
fallback). A scoped resolution media query also tracks device-pixel-ratio
changes when the host's CSS size stays fixed. Rendering retains the existing
2x pixel-ratio cap: changes above that cap rearm the watcher without clearing
the buffer or requesting a redundant redraw. No polling or render loop is added.

`raycast` updates camera and target world matrices before picking, including
before the first render. Invalid or out-of-canvas coordinates return no hits.
After kernel cancellation, resize/render calls are inert and raycasts return no
hits, even while asynchronous cleanup is pending. The adapter releases its
renderer, canvas, resize observer, and resolution listener; application-owned scene resources still
need their own scoped cleanup.

## Context loss and restoration

The adapter emits `three:context-lost` and `three:context-restored` through the
existing event bus. Both carry `ThreeContextEventPayload` with the borrowed
`host` and owned `canvas`; `source` is the adapter ID. Filter by host when
coordinating a scene. The existing renderer also exposes the browser's
`getContext().isContextLost()` query.

While lost, render/resize calls are inert and raycasts return no hits. Three.js
handles native context restoration and rebuilding its renderer resources. The
adapter then applies the latest host size and pixel ratio and emits the restored event; it
retains the same renderer, camera, scene, and canvas. Demand-rendered consumers
must request a fresh draw on restoration. The adapter does not change kernel
lifecycle state, start a render loop, or recreate application-owned scene data.

Recovery notifications stop at kernel cancellation, including during pending
async cleanup. Scope disposal removes the native listeners. The browser may
decline restoration; there is no forced-restore timer or retry loop. The shared
playground keeps recovery feedback and its existing fresh-kernel action visible.

## Example

- `examples/picking/`
- `examples/v02/`

## Borrowed video textures

`@urk/adapters/three/video` exports `createVideoTexture(player, owner)`. Pass an existing video handle and an owner with `scope` and `signal` (for example, the controller context). The returned `{ texture, dispose }` uses Three.js `VideoTexture` with sRGB color. Assign it to your material and request renders from your chosen video time source. Disposal is idempotent; owner cancellation, scope cleanup, or player disposal releases the texture and its native frame callback. It never changes or disposes the borrowed player or renderer. Recreate the binding after replacing the source or changing its dimensions. Native captions need a separate DOM overlay. Cross-origin video must permit texture use through CORS.

This optional subpath requires the existing Three.js peer. `@urk/adapters/video` remains independent of Three.js. A paused native VideoTexture may retain one dormant decoded-frame callback until disposal; it does not continuously render.
