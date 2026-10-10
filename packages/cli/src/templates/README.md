# CLI Templates

This directory holds small source templates used by `@urk/cli`.

Current template modules:

- `create.ts` - standalone-first browser project scaffold for `urk create <name>`
- `create-proof.ts` - repo-only proof scaffold for `urk create-proof <name>`
- `controller.ts` - controller scaffold for `urk create controller <name>`

The standalone v2 template uses actual cancellable content loading, a typed shell contract, owned subscriptions, and host lifecycle controls. It creates no idle update loop. Generated headers use the generation date. Keep the exported adapters array compatible with `urk add adapter`.

Future command-specific templates can live here without pulling scaffolding logic into the CLI entrypoint.
