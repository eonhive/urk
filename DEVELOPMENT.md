# Development Guide

## Setup

This is a TypeScript monorepo using Yarn workspaces.

### Prerequisites

- Node.js 18+
- Yarn 3.x+

### Install dependencies

```bash
corepack enable
corepack yarn install
```

### Build all packages

```bash
corepack yarn build
```

### Watch mode for development

```bash
corepack yarn dev
```

## Project Structure

- `packages/core` - Main runtime kernel
- `packages/adapters` - Capability adapters
- `packages/examples` - Standalone DOM proof example

## Running examples

```bash
corepack yarn workspace @urk/examples dev
```

## Type checking

TypeScript is configured at the root with paths for `@urk/core` and `@urk/adapters` shortcuts.

## Architecture

The runtime is built around:

1. **Kernel** - core lifecycle and context
2. **Adapters** - contract-based capability injection
3. **Controllers** - orchestration and state management
4. **EventBus** - event routing and pub/sub
5. **Update loop** - frame-synchronized execution

See [docs/07_URK/URK_ARCHITECTURE.md](./docs/07_URK/URK_ARCHITECTURE.md) for detailed architecture.

## Testing

Current validation for this milestone is:

- `corepack yarn build` for package-level builds
- direct `tsc --noEmit` checks when needed
- manual browser acceptance in `@urk/examples`

The root `corepack yarn test` command is intentionally honest rather than broad. It reports that this milestone is still manually validated.

## Contributing

See [CONTRIBUTING](./CONTRIBUTING.md) for guidelines (coming soon).
