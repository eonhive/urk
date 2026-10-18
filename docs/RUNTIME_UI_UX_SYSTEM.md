<!--
Company: EonHive Inc.
Title: URK Runtime UI and Interaction
Purpose: Define the implemented runtime UI vocabulary and ownership rules.
Author: Stan Nesi
Created: 2026-10-15
Updated: 2026-10-17
Notes: Vibe coded with Codex.
-->

# URK UI & Interaction

URK UI connects interface controls with interactive experiences while preserving
the host's framework and visual design. Public website presentation remains in
[UI/UX System](UI_UX_SYSTEM.md).

| Term | Meaning |
| --- | --- |
| Controls | Native actions and inputs such as buttons, ranges, and toggles. |
| Overlays | Feedback or content positioned within an experience's host. |
| Panels | Named groups of content and controls. Managed panels are nonmodal. |
| Widgets | A descriptive term for a self-contained feature; no widget registry. |
| Surfaces | Technical mount or rendering areas. |

The concrete capability is **UI Overlay**, imported from
`@urk/adapters/ui-overlay`. `ui-widgets` remains a compatibility entrypoint with
the same factory and token identity. There is no general `ui` adapter or separate
UI package.

## Ownership and interaction

- Controllers own selection, actions, media policy, and async result ordering.
- The overlay adapter owns shells, managed instance lifetimes, and observation.
- Applications mount panel content and return synchronous cleanup functions.
- Hosts own navigation, framework subtrees, layout space, and theming.
- Closing details retains selection. Panel opening does not pause a kernel.
- Nonmodal panels preserve ordinary keyboard navigation. Escape closes the panel
  receiving the event; it does not also trigger scene shortcuts.
- UI updates are event-driven. Text callouts pass pointer input through; panels
  receive input and stop it from bubbling into scene controls.
- Themes use scoped CSS variables. Container width determines compact placement;
  resizing does not remount content or discard focus. Updating a panel's placement
  also preserves its focused control without taking focus from elsewhere.
- Long panel bodies scroll within the available space, keeping their heading and
  Close button outside that scroll area. Narrow or short hosts stack occupied
  slots; multiple panels remain reachable without expanding the surrounding page.
  The named content group is a normal Tab stop for native keyboard scrolling,
  including text-only content. Native controls keep their keyboard behavior, and
  empty overlay space still passes pointer input to the experience.

## Working proof

The Scene/UI Bridge and Project Selection examples share a private selection
controller. Both load details, expose a real appearance-changing action, retain
selection on close, and offer an explicit failure/retry demonstration. Cancellation
and request generations prevent old loads from updating newer or closed panels.
Details failure remains local while the kernel and page continue working.
Selecting the same item while its details are open preserves the panel and current
request. Selecting it after closing reopens details. Closing a pending request
aborts it, settles loading, and replaces busy feedback with a selection-preserved
message; late results cannot change that message.

Retry keeps its control visible and focused while loading, with repeated activation
ignored until the request finishes. A successful retry moves focus to the enabled
action only if focus is still on Retry. Failure leaves Retry available, and a user
who moved elsewhere keeps their focus. Panel content exposes its busy state through
`aria-busy`. The explicit failure demonstration reloads content in the existing
panel, preserving its action state.

Run `corepack yarn dev:examples` and open `/selection-details/` for two independent
instances. Website routes are `/examples/scene-ui-bridge/` and
`/examples/project-selection/`. Both use DOM; Project Selection imports no scene renderer.

See the [adapter usage and contract](../packages/adapters/src/ui-widgets/README.md).
Media widgets, modal dialogs, docking, and a public component library remain
outside this implementation.
