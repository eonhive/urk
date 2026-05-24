<!--
Company: EonHive Inc.
Title: URK Public Website Plan
Purpose: Define the architecture, implementation order, issue breakdown, and quality gates for the URK public website.
Author: Stan Nesi
Created: 2026-05-05
Updated: 2026-05-15
Notes: Vibe coded with Codex.
-->

# URK Public Website Plan

## Summary

URK - Universal Runtime Kernel needs a public website that explains the runtime kernel clearly and proves it through live browser runtime surfaces.

The public site uses Astro, Starlight, Markdown with JSX-style components (MDX), TypeScript, Tailwind CSS, and CSS variables for the static content shell. URK powers runtime-first surfaces: live examples, runtime islands, interactive documentation embeds, and the experimental playground.

Boundary rule:
- Content-first pages use Astro/Starlight.
- Runtime-first surfaces use URK.
- URK is not the whole website framework.

## 1. Public Site Architecture

```text
apps/www
  owns: public routes, docs shell, design system, SEO, static rendering, runtime island host UI

packages/core
  owns: kernel lifecycle, runtime context, explicit state, registries, events, controllers

packages/adapters
  owns: adapter contracts and browser-facing capability implementations

packages/examples
  owns: real runnable examples imported by apps/www
```

Rules:
- `apps/www` may import `@urk/core`, `@urk/adapters`, and `@urk/examples`.
- `packages/core` must not import website code.
- `packages/examples` owns demo behavior; `apps/www` owns presentation and fallback panels.
- Documentation must still render if a runtime island fails.
- Any future planned or experimental demos must be labeled clearly.

## 2. File Tree

Current v1 structure:

```text
apps/www/
  astro.config.mjs
  package.json
  src/
    pages/
      index.astro
      brand.astro
      packages/index.astro
      playground.astro
      examples/index.astro
      examples/[slug].astro
    content/docs/docs/
      index.mdx
      getting-started.mdx
      concepts/
        runtime-kernel.mdx
        adapters.mdx
        controllers.mdx
        state-events.mdx
    components/
      layout/
      marketing/
      docs/
      urk-runtime/
      visuals/
    data/
      site.ts
      navigation.ts
      packages.ts
      examples.ts
      brand.ts
    lib/
      theme.ts
      runtime-islands/example-client.ts
    styles/
      tokens.css
      global.css
```

Target additions:

```text
apps/www/src/content/docs/docs/
  introduction/
  guides/
  examples/
  reference/
  project/

apps/www/src/components/docs/
  Callout.astro
  Tabs.astro
  CopyableCodeBlock.astro

apps/www/src/components/urk-runtime/
  PlaygroundShell.astro
  RuntimeStatePanel.astro
  AdapterListPanel.astro
```

## 3. Design System Tokens

Token source: `apps/www/src/styles/tokens.css`.

Core tokens:
- color background: `--urk-color-background`
- color foreground: `--urk-color-foreground`
- color muted: `--urk-color-muted`
- color border: `--urk-color-border`
- color card: `--urk-color-card`
- color card-hover: `--urk-color-card-hover`
- color primary: `--urk-color-primary`
- color primary-hover: `--urk-color-primary-hover`
- color success: `--urk-color-success`
- color warning: `--urk-color-warning`
- color error: `--urk-color-error`
- color info: `--urk-color-info`
- code background: `--urk-color-code-background`
- code border: `--urk-color-code-border`
- focus ring: `--urk-color-focus-ring`
- fonts: `--urk-font-display`, `--urk-font-body`, `--urk-font-code`
- radius: `--urk-radius-small`, `--urk-radius-medium`, `--urk-radius-large`
- shadows: `--urk-shadow-card`, `--urk-shadow-glow`
- spacing: `--urk-space-1` through `--urk-space-20`

Visual language:
- dark-first
- light-mode ready
- modular node-grid mark
- runtime flow diagrams
- code panels
- schema panels
- event logs
- package cards
- docs sidebars
- interactive preview surfaces

## 4. Homepage Structure

The homepage must answer "What is URK?" within 10 seconds and point to a live runtime proof.

Sections:
- navigation
- hero
- runtime pipeline visual
- why URK
- how URK works
- what URK is / what URK is not
- use cases
- packages
- docs and playground preview
- dark/light theme support
- final call to action
- footer

Required homepage message:
- Main headline: `The runtime kernel for interactive browser experiences.`
- Supporting idea: schema/data enters the runtime kernel, adapters/controllers/state/events coordinate behavior, and a live browser User Interface appears.
- Boundary: not a full framework, product shell, no-code builder, game engine clone, React-only package, or backend platform.

## 5. Docs Information Architecture

Canonical target IA is in `docs/DOCUMENTATION_IA.md`.

Top-level groups:
- Introduction
- Getting Started
- Core Concepts
- Guides
- Examples
- Reference
- Project

Near-term docs implementation order:
1. Expand Introduction.
2. Split Getting Started into task pages.
3. Add guides for minimal runtime, adapters, controllers, static website embedding, and Astro docs embedding.
4. Add reference pages once APIs stabilize.
5. Sync top-level canon docs into public Project docs.

Current state:
- The public Project docs mirror the current root canon for Boundary, Architecture, Decisions, Deferred features, and Roadmap.
- Root docs remain canonical for repo contributors; public Project docs are onboarding summaries.
- `docs/07_URK/` remains archive/reference material, not the primary onboarding path.

## 6. Examples Structure

Source of truth: `packages/examples`.

Initial examples:
- minimal standalone runtime
- adapter registration
- controller orchestration
- runtime state
- event routing
- scene/User Interface bridge
- pointer/input overlay
- embedded docs demo

Example page template:
- title
- one-sentence purpose
- difficulty
- what this teaches
- live preview
- source code
- schema/config panel
- runtime state panel
- event log
- reset/restart button
- explanation
- related docs
- next example

Current state:
- the initial eight public example routes are runnable.
- future examples should be added one at a time with current metadata only after they have a real mount.

## 7. Package Pages Structure

Package overview route: `/packages`.

Cards should show:
- package name
- purpose
- install command or private/experimental status
- stability status
- boundary note

Current package pages:
- `@urk/core`
- `@urk/adapters`
- `@urk/examples`
- `@urk/cli`
- `@urk/react-urk`
- `@urk/next-urk`

Rules:
- Do not create package pages for non-existent workspaces.
- Treat `@urk/examples` as private, internal, unstable, and website-consumed.
- Keep `@urk/react-urk` and `@urk/next-urk` publishable but experimental and downstream from the kernel.
- Keep deferred ideas such as schema contracts and a separate inspector package in roadmap or deferred-feature docs until they are real workspaces.
- Keep wrappers downstream from the kernel.
- Package pages should prioritize install, use, and reference.

## 8. URK Runtime Island Strategy

Runtime islands are hosted by `apps/www` and powered by `packages/examples`.

Flow:
1. Astro renders static fallback HTML.
2. The client loader watches for `[data-urk-example-root]`.
3. The loader imports `@urk/examples`.
4. The example mounts into the host.
5. Teardown runs on page hide or reset.
6. Errors stay inside the runtime panel.

Implementation files:
- `apps/www/src/components/urk-runtime/LiveURKExample.astro`
- `apps/www/src/lib/runtime-islands/example-client.ts`
- `packages/examples/src/catalog.ts`
- `packages/examples/src/minimal-runtime/mount.ts`

Do not invent final runtime APIs for reset, inspector, or schema editing. Use teardown plus remount until kernel contracts stabilize. The current inspector data source lives in `@urk/core`; there is no separate `@urk/inspector` package page yet.

## 9. Playground MVP Scope

The playground is an experimental runtime lab, not a no-code builder.

MVP:
- editable schema/config
- live preview
- event log
- state viewer
- adapter list
- reset button
- no login required
- known-example sandboxing only
- shareable example later

Current state:
- `/playground/` is an experimental known-example config shell.
- The shell validates JSON, current example IDs, adapter/controller names, and the no-custom-code boundary.
- Runtime execution remains on the dedicated example routes until a stable playground mount contract exists.

Do not build:
- marketplace
- hosted user projects
- cloud sync
- auth
- large plugin system
- heavy devtools suite
- arbitrary JavaScript execution

## 10. GitHub Issue Breakdown

Suggested implementation issues:

1. Public site shell
Title: Scaffold `apps/www` Astro/Starlight public site.
Scope: routes, layout, Starlight config, sitemap, Tailwind, tokens.

2. Brand and UI system
Title: Implement URK dark-first design tokens and shared UI primitives.
Scope: header, footer, buttons, badges, cards, code blocks, runtime panels.

3. Landing page
Title: Build the public URK homepage.
Scope: hero, runtime pipeline, value props, boundary section, packages, docs/playground preview.

4. Docs IA
Title: Expand public docs to target URK information architecture.
Scope: Introduction, Getting Started, Core Concepts, Guides, Examples, Reference, Project.

5. Runtime island boundary
Title: Implement isolated URK runtime islands for the website.
Scope: static fallback, lazy mount, local error handling, teardown, reset/restart.

6. Examples catalog
Title: Move public examples into `packages/examples`.
Scope: metadata, source excerpts, schema/config, runnable mount contract.

7. Minimal runtime demo
Title: Build the first real public URK runtime example.
Scope: kernel boot, loading adapter, controller, state panel, event log.

8. Initial example routes
Title: Add routes for the initial example roadmap.
Scope: adapter registration, controller orchestration, runtime state, event routing, scene/UI bridge, pointer/input overlay, embedded docs demo.

9. Playground MVP shell
Title: Build experimental playground shell.
Scope: config editor, preview target, state viewer, adapter list, event log, reset placeholder.

10. Package pages
Title: Build package overview and package detail pages.
Scope: install commands, stability labels, package boundaries, docs links.

11. Accessibility and QA
Title: Run accessibility and responsive quality pass.
Scope: keyboard nav, focus states, contrast, reduced motion, mobile docs navigation.

12. Canon docs sync
Title: Sync root canonical docs into public Starlight docs.
Scope: Boundary, Architecture, Decisions, Deferred, generated frontmatter.

## 11. Implementation Order

1. Lock canonical boundaries in docs.
2. Build `apps/www` static shell.
3. Add design tokens and shared layout.
4. Ship homepage and package overview.
5. Ship minimal docs pages.
6. Add runtime island host and `packages/examples` contract.
7. Build `minimal-runtime` live demo.
8. Add examples index and dynamic example pages.
9. Add initial example pages.
10. Add playground MVP shell.
11. Expand docs IA into full Starlight structure.
12. Add package detail pages and richer reference docs.
13. Add more real examples one at a time.

## 12. Quality And Accessibility Checklist

Current QA pass:
- 2026-05-14: public site shell, examples index, and runtime panels received a focused keyboard/focus/mobile/reduced-motion pass.

Build quality:
- `@urk/www check` passes.
- `@urk/www build` passes.
- `@urk/examples build` passes.
- static routes render without server-side runtime.

Boundary quality:
- Astro/Starlight owns content-first pages.
- URK powers runtime-first surfaces.
- private, experimental, or deferred packages/examples are labeled.
- URK is never described as a full framework or no-code builder.

Accessibility:
- one `h1` per page.
- keyboard reachable navigation, buttons, theme toggle, and runtime controls.
- visible focus states.
- sufficient contrast in dark and light modes.
- no status communicated by color alone.
- reduced motion disables decorative animation.
- docs remain useful with JavaScript disabled.

UX:
- homepage explains URK quickly.
- examples prove runtime behavior.
- package pages show install/status/reference.
- docs follow a learning path.
- playground is clearly experimental.
- runtime failures stay local to runtime panels.

Performance:
- content pages are static.
- runtime examples load only where mounted.
- homepage runtime proof remains lightweight.
- code blocks and docs do not require runtime hydration.
