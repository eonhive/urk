# UI Overlay Adapter (UI Widgets Compatibility)

Provides runtime status, independent text callouts, and application-mounted nonmodal panels.

Prefer `@urk/adapters/ui-overlay`, `createUiOverlayAdapter`, and
`UiOverlayCapability`. The original `@urk/adapters/ui-widgets` path, factory, and
token remain supported and share the same implementation and identity. Legacy
`ui-widgets` string lookup and `ui-widgets-adapter` default ID remain unchanged.

## Requires

- `ui:host` `HTMLElement` service

## Exposes

- `setStatus(...)`
- `showCallout(...)`
- `hideCallout()`
- `destroy()`
- `open(options)` returns an instance handle with `update(patch)`, `close()`, and `closed`.
- `getSnapshot()` and `subscribe(listener)` observe managed instances created with `open()`.

The compatibility status surface uses `role="status"` with atomic announcements; repeating the
same message does not rewrite the live region. Callouts use `role="note"`, named
by their title. `data-urk-overlay`, `data-overlay-status`, and
`data-overlay-callout` identify the owned surfaces. The overlay stays
pointer-transparent except for managed panels; native controls remain application-owned. Its supplied
host must establish a positioning context and enough space for the feedback.

## Managed instances

```ts
import { UiOverlayCapability } from '@urk/adapters/ui-overlay';

const ui = ctx.require(UiOverlayCapability);
const card = ui.open({
  id: 'selected-item', kind: 'callout', title: 'Orbit', body: 'Selected item details',
  placement: 'bottom-end',
});
card.update({ body: 'Details updated' });
ctx.scope.defer(() => card.close());

const panel = ui.open({
  id: 'settings', kind: 'panel', title: 'Settings',
  mount(container) {
    const button = document.createElement('button');
    button.textContent = 'Enable sound';
    const enable = () => enableExperienceSound(); // Application-owned behavior.
    button.addEventListener('click', enable);
    container.append(button);
    return () => {
      button.removeEventListener('click', enable);
      button.remove();
    };
  },
});
ctx.scope.defer(() => panel.close());
```

- Kinds: `status` (`message`, optional `progress` from 0 to 1), `callout` (`title`, `body`, optional `tone`), and `panel` (`title`, synchronous `mount`). `progress: null` hides progress.
- Placement: `top-start` (default), `top-end`, `bottom-start`, `bottom-end`, relative to the supplied host. Hosts at most 520px wide or 360px high stack occupied slots using a container query.
- Duplicate active IDs reject. Closing is idempotent; updating a closed handle rejects. Reusing an ID never gives an old handle control over the new instance.
- Panel content mounts once. Update title or placement without remounting or losing focus in its controls; updates do not take focus from outside the panel. Close and reopen to replace content. Mount callbacks return a synchronous cleanup function. A callback that throws before returning must release any resources it acquired.
- Close and Escape dismiss the focused panel without trapping focus. Focus returns to the opener only when dismissal removed the current focus; closing never clears application selection or pauses the runtime.
- Panels stop bubbling pointer/click/keyboard events. Hosts must not route scene input from document capture listeners without filtering UI targets.
- Snapshots are cached, immutable, serializable, and contain no content callbacks or DOM references. Listener failures are isolated. The legacy singleton status/callout are independent of this managed-instance list.
- Adapter destruction removes every managed instance and the legacy shell, releases subscribers, preserves the host, and rejects managed opens/updates. Late legacy singleton writes are ignored. All content cleanup runs even if one disposer throws.

## Presentation

Styles ship inside the JavaScript module; no separate CSS import is required.
Set `data-urk-ui-theme="light"` or `"dark"` on the supplied host. Override inherited
`--urk-ui-background`, `--urk-ui-foreground`, `--urk-ui-border`, `--urk-ui-active`,
`--urk-ui-selected`, `--urk-ui-focus`, `--urk-ui-accent`, `--urk-ui-font`,
`--urk-ui-radius`, and `--urk-ui-space` to match an application. Theme and size
changes preserve mounted content and focus. The default remains dark, with the
legacy status/callout baseline appearance preserved. The host supplies positioning
and sufficient height; this adapter does not measure or resize the surrounding page.

Panel bodies scroll when content exceeds the available height, while the heading
and Close button remain outside the body's scroll area. The body is a named,
focusable `Panel content` group: Tab reaches it after Close, and native scrolling
keys work even for text-only content. Further Tab navigation brings offscreen
controls into view. Scrolling a body to its boundary does not
continue scrolling the surrounding page. Several panels in one slot can also
overflow that slot; bottom alignment keeps the first panel reachable. Empty slots
take no space in the stacked layout, and empty overlay areas remain pointer-transparent.
These limits follow the host's dimensions through CSS, without resize observers
or a frame loop. Hosts must still provide enough space for a readable heading and
controls, especially with unusually long titles or large custom spacing.

The shared [selection proof](../../../examples/src/selection-details/mount.ts)
demonstrates scene and webpage use, real actions, retryable loading errors, and
controller-local cancellation of stale results. Closing a pending details request
settles its loading feedback. Retry retains focus while pending and hands it to the
ready action only when the user has not moved elsewhere. Repeated selection of the
open item preserves its panel and request. Modal dialogs, toast queues,
anchoring to 3D objects, and docking remain deferred.

## Example

- `examples/audio-proof/`
- `examples/picking/`
- `examples/loading-transition/`
- `examples/app-shell/`
- `examples/scrollytelling/`
