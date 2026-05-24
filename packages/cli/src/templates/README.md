# CLI Templates

This directory holds small source templates used by `@urk/cli`.

Current template modules:

- `create.ts` - standalone-first browser project scaffold for `urk create <name>`
- `create-proof.ts` - repo-only proof scaffold for `urk create-proof <name>`
- `controller.ts` - controller scaffold for `urk create controller <name>`

Future command-specific templates can live here without pulling scaffolding logic into the CLI entrypoint.
