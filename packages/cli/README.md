# `@urk/cli`

`@urk/cli` is the early developer tooling package for URK.

CLI means **Command-Line Interface**.

The package exists to help developers scaffold, inspect, and statically validate URK projects. It
does **not** own runtime behavior, browser mounting, adapter execution, controller orchestration,
or any other kernel responsibility.

## What it is

- developer tooling for URK projects and repo-only proofs
- source-based scaffolding and mutation
- static project checking and static project inspection
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
corepack yarn workspace @urk/cli build
```

Run it from the built entrypoint:

```bash
node packages/cli/dist/index.js --help
```

You can also run a specific command directly:

```bash
node packages/cli/dist/index.js inspect
```

## Commands

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
- `src/controllers/app.controller.ts`

### `urk create-proof <name>`

Scaffold a repo-only proof route under `examples/`.

Example:

```bash
node packages/cli/dist/index.js create-proof loading-flow
```

This command is monorepo-only. It updates the private proof workspace routing files as part of the
scaffold.

### `urk add adapter <name>`

Add one supported DOM adapter to `src/adapters.ts` in a standalone URK project.

Current supported names are defined by the CLI adapter catalog and include the DOM-first adapters
used by generated projects.

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
