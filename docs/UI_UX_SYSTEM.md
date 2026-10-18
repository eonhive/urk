<!--
Company: EonHive Inc.
Title: URK Public Website UI/UX System
Purpose: Define the public website interface system, interaction rules, states, and responsive behavior for URK.
Author: Stan Nesi
Created: 2026-05-05
Updated: 2026-10-11
Notes: Vibe coded with Codex.
-->

# URK Public Website UI/UX System

## Product Frame

URK - Universal Runtime Kernel is a public open-source runtime kernel for browser-native interactive experiences. The website should look and behave like credible developer tooling: clear, creative, modular, and welcoming, while showing real runtime behavior.

UI means User Interface. UX means User Experience.

Runtime controls, overlays, and panel ownership are documented separately in
[Runtime UI & Interaction](RUNTIME_UI_UX_SYSTEM.md).

## Design Goals

- Dark-first, with complete light-mode support.
- Creative and precise: original miniature-world art, a faceted cyan–violet mark, and readable controls.
- Deep navy dark surfaces and cool blue light surfaces; gradients reserved for key headlines and primary actions.
- Highly readable documentation.
- Credible open-source presentation with visible runtime proof surfaces.
- Clear separation between static content and live URK runtime islands.

## Token List

Canonical implementation lives in `apps/www/src/styles/tokens.css`.

| Token | Purpose |
| --- | --- |
| `--urk-color-background` | Page background. |
| `--urk-color-foreground` | Primary text. |
| `--urk-color-muted` | Secondary text and low-emphasis labels. |
| `--urk-color-border` | Hairline borders and structural dividers. |
| `--urk-color-card` | Default card and panel surface. |
| `--urk-color-card-hover` | Interactive card hover surface. |
| `--urk-color-primary` | Violet text and active accents; primary actions use `--urk-gradient`. |
| `--urk-color-primary-hover` | Primary action hover state. |
| `--urk-color-success` | Runtime success and current status. |
| `--urk-color-warning` | Experimental, adapter, or caution state. |
| `--urk-color-error` | Failure and destructive state. |
| `--urk-color-info` | Informational accents and neutral runtime notes. |
| `--urk-color-code-background` | Code block background. |
| `--urk-color-code-border` | Code block border. |
| `--urk-color-code-text` | Code text. |
| `--urk-color-focus-ring` | Keyboard focus ring. |
| `--urk-font-display` | Wordmark, hero, and section headings. |
| `--urk-font-body` | Body copy, navigation, forms, and UI. |
| `--urk-font-code` | Code, schema, logs, runtime IDs, and package names. |
| `--urk-radius-small` | Chips, compact buttons, and small controls. |
| `--urk-radius-medium` | Buttons, code blocks, and inputs. |
| `--urk-radius-large` | Cards, panels, and runtime surfaces. |
| `--urk-shadow-card` | Default panel shadow. |
| `--urk-shadow-glow` | Rare kernel glow for active runtime moments. |
| `--urk-space-1` to `--urk-space-20` | Spacing scale from 4px to 80px. |

Legacy aliases such as `--urk-background`, `--urk-foreground`, and `--urk-primary` remain supported because existing components already use them.

## Component Inventory

| Component | Purpose | Current implementation |
| --- | --- | --- |
| Header | Primary navigation and brand entry point. | `SiteHeader.astro`. |
| Footer | Secondary navigation, brand summary, and project links. | `SiteFooter.astro`. |
| Button | Primary, secondary, and ghost actions. | `.site-button` classes. |
| Badge | Status, maturity, and difficulty labels. | `StatusBadge.astro` and `.site-status-badge`. |
| FeatureCard | Short value proposition card. | `FeatureCard.astro`. |
| PackageCard | Package purpose, install command, and status. | `PackageCard.astro`. |
| ExampleCard | Example purpose, difficulty, status, and boundary. | `ExampleCard.astro`. |
| CodeBlock | Copyable code and shell snippets. | `CodeBlock.astro`. |
| Tabs | Future docs/reference panel switching. | Use for code/schema/state views when needed. |
| DocsSidebar | Section navigation for docs. | Starlight sidebar, themed through tokens. |
| TableOfContents | Right-side long-doc navigation. | Starlight table of contents. |
| Callout | Docs warning, note, and boundary blocks. | Use Starlight callouts or add a thin wrapper later. |
| RuntimeDiagram | Runtime flow and node-grid visuals. | `HeroRuntimeDiagram.astro` and `RuntimePipeline.astro`. |
| RuntimeLog | Event stream display. | `RuntimeLogPanel.astro`. |
| SchemaPanel | Declarative schema/config display. | `SchemaPanel.astro`. |
| PreviewPanel | Live browser runtime surface. | `PreviewPanel.astro`. |
| ThemeToggle | Dark/light mode control. | `ThemeToggle.astro`. |
| SearchInput | Documentation search. | Starlight search, themed through tokens. |
| CommandMenu placeholder | Later keyboard command surface. | Do not build until real commands exist. |
| PlaygroundShell | Experimental runtime lab layout. | Shared v0.2 scene and lifecycle inspector, with config tools on their existing subroute. |

## Component Rules

- Header keeps `Docs`, `Examples`, `Packages`, `Playground`, and `GitHub` obvious.
- Footer includes docs, examples, packages, brand, and GitHub.
- Buttons use verbs and clear destinations. Primary buttons are rare.
- Badges always pair color with text such as `Current`, `Experimental`, `Planned`, `Intro`, or `Advanced`.
- Cards are for repeated items and runtime panels. Do not wrap page sections in nested cards.
- Code blocks are copyable, readable, and use the mono font.
- Runtime logs use timestamp, source, event type, and compact payload summary.
- Schema panels are read-only outside the playground.
- Preview panels must show local error states if runtime mounting fails.

## Responsive Rules

- Desktop starts at `1200px`: use two-column heroes, three-column package/example grids, and right-side docs table of contents.
- Tablet starts at `768px`: stack hero media below content, use two-column cards, keep docs side navigation accessible.
- Mobile below `768px`: collapse grids to one column, keep tap targets at least 44px high, and avoid horizontal scrolling except inside code blocks.
- Long docs use a collapsible sidebar on mobile and a visible table of contents on larger screens.
- Runtime panels stack as schema/config, preview, then event log on mobile.
- Code blocks keep horizontal scroll inside the block, never the page.
- Header uses two compact rows below 960px, with visible navigation and theme controls; it scrolls with the page.

## Accessibility Rules

- Use one `h1` per page and maintain heading order.
- Every interactive element must be keyboard reachable.
- Focus states must be visible in dark and light themes.
- Do not rely on color alone for status or errors.
- Theme toggle requires an accessible label and persistent state.
- Copy buttons must expose a text label and remain buttons, not clickable spans.
- Runtime demo failures must announce visible text in the local panel.
- Reduced-motion users should not receive animated flow lines, pulsing nodes, or hover movement.
- Code, schema, and event logs must preserve text contrast at AA level or better.
- Docs pages must remain readable with JavaScript disabled.

## Interaction Rules

- Homepage introduces a tiny runtime for interactive experiences through original artwork, concise copy, capability links, and a direct playground action.
- Homepage must point to a real runtime example so the site proves URK is running somewhere.
- Docs prioritize learning flow over feature marketing.
- Examples prioritize live proof: preview, schema/config, state, event log, source, reset, explanation, docs, next example.
- Package pages prioritize install, status, package purpose, and reference links.
- Theme toggle is visible in the header but visually secondary to navigation and `Get started`.
- Tabs should preserve selection in the page only; do not introduce global state for simple docs panels.
- Reset/restart for examples uses teardown plus remount until a stable runtime reset API exists.
- The main playground uses the shared 3D experience; the existing schema/config editor stays at `/playground/config/`.
- Command menu remains a placeholder until there are real commands worth invoking.

## Empty, Loading, and Error States

| Surface | Empty state | Loading state | Error state |
| --- | --- | --- | --- |
| Runtime preview | "Waiting for runtime activity." | Show current phase, stage, and progress. | Show local mount failure and keep page usable. |
| Event log | One placeholder event row. | Append bounded recent events. | Show event logging failure only inside log panel. |
| Schema panel | Show current schema/config or planned config. | No spinner needed for static schema. | Show validation issue near the field in playground. |
| State viewer | `phase: planned` or `phase: boot`. | Update phase and selected values. | Show `phase: error` and reason. |
| Adapter list | Show required adapters from metadata. | Mark adapters as registering. | Mark missing capability with text and warning color. |
| Examples index | Show current examples and any non-current entries with explicit status. | Static page should not need loading UI. | Build-time failure, not runtime failure. |
| Docs search | Empty query state. | Use Starlight search behavior. | Show no-results state, not a page error. |
| Playground | Starter config in editor. | Mount preview and disable run/reset as needed. | Keep error inside preview/config panel. |

## Page UX Priorities

- Homepage: explain URK in 10 seconds and link to a live runtime proof.
- Docs: teach in sequence with clear prerequisites and next pages.
- Examples: prove one runtime concept per page.
- Packages: be honest about maturity and install paths.
- Playground: prioritize the scene and interaction, with a compact lifecycle inspector and clear pause/resume/recovery controls.
- Brand page: document identity and assets without distracting from product IA.

## Implementation Notes

- `apps/www` owns presentation, layout, docs chrome, and fallback UI.
- `packages/examples` owns runnable proof behavior.
- Starlight owns docs sidebar, table of contents, and search until there is a reason to replace them.
- URK runtime islands mount client-side and must fail locally.
- Future planned surfaces should say `Planned` or `Experimental`; do not style them like shipped runtime features.
- Keyboard and responsive QA should prefer durable semantics first: visible skip link, `aria-current`, grouped runtime controls, labeled logs, and live progress/status regions before visual-only polish.

## v0.2 identity — 2026-10-11

Use uppercase **URK** in the public identity. Universal Runtime Kernel and existing package names stay unchanged. Editable faceted SVG marks, theme-specific lockups, favicon, icons, and social artwork live in `apps/www/public/brand/` and the public root. `src/data/brand.ts` documents the palette and downloads. Fonts remain self-hosted Space Grotesk, Geist, and IBM Plex Mono.

The homepage hero is illustrative artwork, linked separately from the working playground. References guide visual direction; they do not introduce an editor, pricing, marketplace, or hosted publishing product. Primary copy is “A tiny runtime. Big possibilities.”

Shared playground controls expose pause/resume availability and diagnostics state. Theme changes redraw once through a scoped observer without starting a continuous loop. Pause cancels animation; resize/theme changes may repaint a frozen scene, while disposal cancels all drawing. Layout transitions are finite and respect reduced motion; layout and rotation use native controls. Narrow layouts keep overlay feedback below the canvas so every object stays visible and selectable. Storage failure must leave the theme control usable for the current page. The scene remains dark in both themes for consistent object contrast.

The original hero was generated with the built-in image tool, then given a transparent background for both themes. The optimized [WebP](../apps/www/public/brand/art/runtime-world.webp) and exact [prompt set](../apps/www/public/brand/art/runtime-world.prompt.txt) are kept with the brand assets. SVG marks and icons remain code-native.
