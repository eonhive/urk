# Input Adapter

Provides keyboard-first input normalization for URK.

## Requires

- optional `input:target` service with `Window`, `Document`, or `HTMLElement`

## Exposes

- `isPressed(...)`
- `bindKey(...)`
- `subscribe(...)`
- `clear()`

## Focus and cancellation

Pressed keys clear on window blur, a hidden document, kernel cancellation, or
focus leaving an `HTMLElement` target's subtree. Moving focus between controls
inside that target retains the pressed set. Key delivery stops as soon as the
kernel aborts, before potentially asynchronous cleanup finishes.

The adapter does not override native form controls. Controllers should scope
scene shortcuts to the scene's focused element instead of consuming keys from
buttons, selects, or sliders.

## Example

- `examples/audio-proof/`
- `examples/picking/`
- `examples/app-shell/`
- `examples/scrollytelling/`
- `examples/runtime-inspector/`
