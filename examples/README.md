# URK Examples

This workspace is private and repo-only. It exists to make URK easy to understand, not to publish installable example packages.

## Run locally

```bash
corepack yarn workspace urk-examples dev
```

Or from the repo root:

```bash
corepack yarn dev
```

## Routes

- `/` - examples index
- `/audio-proof/` - DOM-first audio transport proof
- `/picking/` - DOM plus Three picking proof
- `/loading-transition/` - staged loading and transition proof
- `/app-shell/` - DOM-first app shell orchestration proof
- `/react-starter/` - React wrapper proof
- `/scrollytelling/` - DOM-first story orchestration proof
- `/runtime-inspector/` - runtime inspector proof

Each proof folder contains:

- `README.md` - what the proof demonstrates and how URK is used
- `index.html` - page shell
- `styles.css` - proof styling
- `main.ts` or `main.tsx` - proof logic

The standalone Next proof stays outside this workspace at `apps/next-proof`.
