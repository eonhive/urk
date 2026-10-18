# Motion Playground

Run `node scripts/build.mjs @urk/examples`, then
`corepack yarn workspace urk-examples dev --host 127.0.0.1` from the repository root
under Node 22. Open `http://127.0.0.1:5173/motion-playground/`.

A Three mesh's numeric position and a native DOM caption share a scoped motion
adapter. Direction changes replace the tween from its current value. Try runtime
and individual pause, finish, cancel, immediate completion, system reduced motion,
owner disposal/recreation, and kernel destruction/restart. Auto frames run only
while the numeric tween needs them; `onUpdate` redraws the borrowed scene.
