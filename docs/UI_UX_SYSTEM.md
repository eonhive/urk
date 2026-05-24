<!--
Company: EonHive Inc.
Title: URK Public Website UI/UX System
Purpose: Define the public website interface system, interaction rules, states, and responsive behavior for URK.
Author: Stan Nesi
Created: 2026-05-05
Updated: 2026-05-14
Notes: Vibe coded with Codex.
-->

# URK Public Website UI/UX System

## Product Frame

URK - Universal Runtime Kernel is a public open-source runtime kernel for browser-native interactive experiences. The website should look and behave like credible developer tooling: precise, minimal, readable, runtime-native, and serious without being cold.

UI means User Interface. UX means User Experience.

## Design Goals

- Dark-first, with complete light-mode support.
- Technical and precise, not playful.
- Polished developer-tool look, not generic software-as-a-service marketing.
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
| `--urk-color-primary` | Violet kernel accent and primary actions. |
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
| PlaygroundShell | Experimental runtime lab layout. | `playground.astro` shell, not a stable builder. |

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
- Header navigation may wrap before it becomes a menu; no link should be hidden without an accessible replacement.

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

- Homepage answers "What is URK?" in the first viewport through headline, subheadline, trust chips, and runtime flow.
- Homepage must point to a real runtime example so the site proves URK is running somewhere.
- Docs prioritize learning flow over feature marketing.
- Examples prioritize live proof: preview, schema/config, state, event log, source, reset, explanation, docs, next example.
- Package pages prioritize install, status, package purpose, and reference links.
- Theme toggle is visible in the header but visually secondary to navigation and `Get started`.
- Tabs should preserve selection in the page only; do not introduce global state for simple docs panels.
- Reset/restart for examples uses teardown plus remount until a stable runtime reset API exists.
- Playground accepts schema/config first, not arbitrary JavaScript.
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
- Playground: present an experimental runtime lab, not a product builder.
- Brand page: document identity and assets without distracting from product IA.

## Implementation Notes

- `apps/www` owns presentation, layout, docs chrome, and fallback UI.
- `packages/examples` owns runnable proof behavior.
- Starlight owns docs sidebar, table of contents, and search until there is a reason to replace them.
- URK runtime islands mount client-side and must fail locally.
- Future planned surfaces should say `Planned` or `Experimental`; do not style them like shipped runtime features.
- Keyboard and responsive QA should prefer durable semantics first: visible skip link, `aria-current`, grouped runtime controls, labeled logs, and live progress/status regions before visual-only polish.
