<!--
Company: EonHive Inc.
Title: URK Documentation Information Architecture
Purpose: Define the public documentation structure, page goals, examples, and live demo expectations for URK.
Author: Stan Nesi
Created: 2026-05-05
Updated: 2026-05-14
Notes: Vibe coded with Codex.
-->

# URK Documentation Information Architecture

## Purpose

URK - Universal Runtime Kernel documentation teaches developers what URK is, what it is not, how the runtime model works, and how to build browser-native interactive runtime surfaces.

The docs serve:
- new developers
- frontend engineers
- runtime and platform engineers
- open-source contributors
- future adapter authors
- future controller authors

## Writing Rules

- Use direct, plain language.
- Define abbreviations on first use. User Interface (UI), Static Site Generation (SSG), Markdown with JSX-style components (MDX), Command-Line Interface (CLI), and Application Programming Interface (API) should not appear unexplained on first mention.
- Teach hard concepts in two passes: plain explanation first, technical detail second.
- Use diagrams when the concept involves flow, lifecycle, or dependency direction.
- Mark unstable APIs, experimental wrappers, and any future planned examples clearly.
- Do not describe URK as a full application framework, product shell, no-code builder, game engine, backend platform, or React-only package.

## Sidebar Structure

```text
Introduction
  What is URK?
  Why URK?
  What URK is not
  Core mental model

Getting Started
  Installation
  Create your first runtime
  Register an adapter
  Register a controller
  Mount a runtime surface
  View runtime events

Core Concepts
  Runtime kernel
  Runtime context
  Explicit runtime state
  Adapter contracts
  Adapter capability lookup
  Controller lifecycle
  Event routing
  Scene/User Interface bridge
  Integration wrappers

Guides
  Build a minimal runtime example
  Create an adapter
  Create a controller
  Use runtime state safely
  Route events
  Bridge scene and User Interface
  Embed URK in a static website
  Use URK inside Astro docs
  Use URK with React
  Use URK with Next.js

Examples
  Minimal standalone runtime
  Adapter registration
  Controller orchestration
  Runtime state panel
  Event routing demo
  Pointer/input overlay
  Scene/User Interface coordination
  Playground starter

Reference
  @urk/core
  @urk/adapters
  @urk/examples
  @urk/react-urk
  @urk/next-urk
  CLI commands
  Runtime types
  Adapter contract types
  Controller contract types
  Event types
  Error types

Project
  Boundary
  Architecture
  Decisions
  Deferred features
  Contributing
  Roadmap
```

## Introduction

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| What is URK? | Defines URK as a public open-source runtime kernel for browser-native interactive experiences. | Know what URK owns and why it exists. | None. | Product definition; runtime kernel meaning; browser-native focus; adapters/controllers/state/events overview. | Small schema/data to runtime to UI sketch. | Optional hero pipeline. | Treating URK as a framework or state manager. | Why URK?; Core mental model. |
| Why URK? | Explains the runtime problem URK solves. | Know when URK is useful. | What is URK? | Runtime-first browser surfaces; explicit orchestration; capability lookup; why not framework lock-in. | Before/after pseudocode for hidden app logic vs explicit runtime flow. | Minimal Runtime. | Using URK for static content pages. | What URK is not; Runtime kernel. |
| What URK is not | Sets boundaries early. | Avoid category mistakes. | What is URK? | Not a full framework; not a product shell; not a backend; not no-code; not React-only; not business logic. | Boundary comparison table. | None. | Asking URK to render documentation or own app-specific policy. | Core mental model; Boundary. |
| Core mental model | Teaches schema/data -> runtime kernel -> registry/adapters/controllers/state/events -> browser UI. | Understand the core runtime flow. | What is URK?; Why URK? | Flow diagram; kernel role; adapter role; controller role; state/event visibility; browser mount. | Annotated runtime flow snippet. | Hero runtime demo. | Collapsing adapters, controllers, and state into one bucket. | Create your first runtime; Runtime context. |

## Getting Started

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Installation | Shows current package install path and maturity labels. | Install only the packages needed for the first runtime. | TypeScript basics. | Current packages; private/internal packages; local workspace notes; Node/package-manager expectations. | `pnpm add @urk/core @urk/adapters` or workspace equivalent. | None. | Installing private/internal packages or wrappers first. | Create your first runtime; @urk/core. |
| Create your first runtime | Boots the smallest runtime. | Get a running kernel in the browser. | Installation. | Host element; create kernel; boot lifecycle; teardown. | Minimal kernel bootstrap snippet. | Minimal Runtime. | Adding multiple adapters/controllers before the first proof runs. | Register an adapter; Register a controller. |
| Register an adapter | Adds one capability. | Understand how capabilities enter the runtime. | Create your first runtime. | Adapter contract; registration timing; required lookup; failure path. | Loading adapter registration snippet. | Adapter Registration current at `/examples/adapter-registration/`. | Treating adapters as global singletons. | Adapter contracts; Register a controller. |
| Register a controller | Adds orchestration. | Understand controller ownership. | Create your first runtime. | Controller lifecycle; context access; adapter use; event emission; cleanup. | Minimal controller registration snippet. | Controller Orchestration current at `/examples/controller-orchestration/`. | Putting adapter implementation code inside controllers. | Controller lifecycle; Mount a runtime surface. |
| Mount a runtime surface | Connects runtime behavior to a browser surface. | Mount and dispose cleanly. | Register an adapter; Register a controller. | DOM host; static shell; runtime island; disposal; error state. | `mount(host) => teardown` example. | Minimal Runtime. | Letting page shell and runtime surface become one framework. | View runtime events; Embed URK in a static website. |
| View runtime events | Shows runtime visibility. | Read emitted events and phase changes. | Create your first runtime. | Event shape; event log; sources; payload summaries; debugging loop. | Emit/listen/log snippet. | Event log in Minimal Runtime. | Hiding transitions inside framework state. | Event routing; Runtime state panel. |

## Core Concepts

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Runtime kernel | Explains bootstrap, lifecycle, scheduling, and disposal. | Know what the kernel owns. | Core mental model. | Lifecycle diagram; boot; update/tick; shutdown; guards; boundaries. | Kernel lifecycle snippet. | Minimal Runtime. | Treating the kernel as an app shell. | Runtime context; Explicit runtime state. |
| Runtime context | Explains shared runtime access. | Know how runtime parts communicate. | Runtime kernel. | Context contents; state; adapters; events; services; lifetime. | Context access snippet. | None. | Using ambient globals instead of context. | Adapter capability lookup; Controller lifecycle. |
| Explicit runtime state | Explains phases, snapshots, and transitions. | Keep runtime state visible and bounded. | Runtime kernel. | Phase model; state snapshots; transitions; debug visibility; product-state boundary. | Phase transition snippet. | Runtime State current. | Mixing product data into kernel runtime state. | Event routing; Use runtime state safely. |
| Adapter contracts | Explains capability contracts. | Write or consume adapters correctly. | Runtime context. | Contract shape; init/runtime/teardown; fallback; browser capabilities. | Adapter interface sketch. | Adapter Registration current at `/examples/adapter-registration/`. | Letting adapters own orchestration. | Adapter capability lookup; Create an adapter. |
| Adapter capability lookup | Explains explicit capability discovery. | Resolve capabilities without hidden wiring. | Adapter contracts. | Registration; require/optional lookup; missing adapter behavior; visibility. | Required and optional lookup snippets. | Adapter Registration current at `/examples/adapter-registration/`. | Assuming every runtime has every adapter. | Register an adapter; Runtime context. |
| Controller lifecycle | Explains controller start/update/dispose. | Write orchestration that fits the kernel. | Runtime context. | Lifecycle diagram; start; update; events; state changes; cleanup. | Controller lifecycle snippet. | Controller Orchestration current at `/examples/controller-orchestration/`. | Letting controllers own rendering or adapter internals. | Create a controller; Event routing. |
| Event routing | Explains event movement through the runtime. | Use events for observable coordination. | Explicit runtime state. | Event flow diagram; emit; listen; source; payload; log. | Emit/listen snippet. | Event Routing current. | Using events for every direct interaction. | View runtime events; Route events. |
| Scene/User Interface bridge | Explains scene/UI coordination without engine scope. | Keep scene and UI state synchronized. | Runtime context; Event routing. | Bridge diagram; overlays; shared runtime state; pointer feedback; boundary from game engines. | Scene/UI bridge pseudocode. | Scene/UI Bridge current. | Turning URK into a renderer or game engine. | Bridge scene and User Interface; Pointer/input overlay. |
| Integration wrappers | Explains React and Next.js wrappers as downstream integrations. | Keep standalone-first architecture clear. | Runtime kernel. | Wrapper role; client boundary; provider pattern; what wrappers must not own. | Current wrapper snippets, marked experimental. | None. | Treating React/Next wrappers as the source of truth. | Use URK with React; Use URK with Next.js. |

## Guides

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Build a minimal runtime example | Walks through the canonical first proof. | Recreate the minimal runtime. | Getting Started. | File map; kernel; adapter; controller; panels; teardown. | End-to-end minimal example excerpts. | Minimal Runtime. | Expanding scope before the runtime model is readable. | Minimal standalone runtime; Create an adapter. |
| Create an adapter | Teaches adapter authoring. | Build one browser capability. | Adapter contracts. | Contract; implementation; registration; teardown; errors. | Loading or storage adapter walkthrough. | Adapter Registration current at `/examples/adapter-registration/`. | Putting product policy into adapters. | Adapter contract types; Register an adapter. |
| Create a controller | Teaches controller authoring. | Build focused orchestration. | Controller lifecycle. | Responsibilities; state reads/writes; adapter access; event handling; cleanup. | Controller walkthrough. | Controller Orchestration current at `/examples/controller-orchestration/`. | Making controllers render UI directly. | Controller contract types; Use runtime state safely. |
| Use runtime state safely | Teaches bounded state practices. | Avoid state drift. | Explicit runtime state. | Runtime vs product state; transitions; snapshots; derived values. | Safe state update patterns. | Runtime State current. | Treating runtime state as application database. | Runtime state panel; Event types. |
| Route events | Teaches event design. | Use events without event sprawl. | Event routing. | Event naming; payloads; listeners; direct calls vs events; logs. | Event routing examples. | Event Routing current. | Routing simple local changes through events. | Event types; View runtime events. |
| Bridge scene and User Interface | Teaches scene/UI coordination. | Coordinate surfaces cleanly. | Scene/User Interface bridge. | Shared runtime state; overlay updates; pointer feedback; failure boundary. | Overlay sync snippet. | Scene/UI Bridge current. | Coupling UI to renderer internals. | Scene/User Interface coordination; Pointer/input overlay. |
| Embed URK in a static website | Teaches runtime islands in static shells. | Mount URK inside SSG pages. | Mount a runtime surface. | Astro shell; client island; fallback; lazy mount; teardown. | Runtime island host snippet. | Minimal Runtime. | Making URK render static docs. | Use URK inside Astro docs. |
| Use URK inside Astro docs | Teaches MDX embedded examples. | Add live examples to docs safely. | Embed URK in a static website. | MDX component; lazy loading; local error state; authoring rules. | `<LiveURKExample example="embedded-docs-demo" />`. | Embedded Docs Demo current at `/examples/embedded-docs-demo/`. | Blocking docs content on runtime maturity. | Embedded Docs Demo; Documentation home. |
| Use URK with React | Explains the experimental React integration boundary. | Understand wrapper boundaries. | Integration wrappers. | Experimental wrapper status; client host; provider role; no kernel redefinition. | Current wrapper snippet. | None. | Treating React as the runtime source of truth. | Use URK with Next.js; Integration wrappers. |
| Use URK with Next.js | Explains the experimental Next.js integration boundary. | Understand static/server/client boundaries. | Use URK with React. | Experimental wrapper status; client components; static docs; runtime island mount. | Current client-boundary wrapper snippet. | None. | Treating server rendering as runtime execution. | Architecture; Deferred features. |

## Examples

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Minimal standalone runtime | Documents the first working proof. | Understand the smallest credible URK runtime. | Build a minimal runtime example. | Purpose; schema/config; live preview; state; events; source; reset. | `minimal-runtime/mount.ts` excerpts. | Required. | Adding extra adapters too early. | Adapter registration. |
| Adapter registration | Shows capability registration and lookup. | See adapters in isolation. | Register an adapter. | Adapter contract; registration; lookup; missing capability behavior. | Adapter registration source excerpts. | Current at `/examples/adapter-registration/`. | Hiding missing-capability failures. | Controller orchestration; Create an adapter. |
| Controller orchestration | Shows controller lifecycle and coordination. | Understand controller ownership. | Register a controller. | Start/update/dispose; state changes; events; cleanup. | Controller orchestration excerpts. | Current at `/examples/controller-orchestration/`. | Turning the example into a product shell. | Runtime state panel; Create a controller. |
| Runtime state panel | Shows explicit state and updates. | Read runtime phases and snapshots. | Explicit runtime state. | State panel; transitions; snapshot; reset; explanation. | Runtime State source excerpts. | Current at `/examples/runtime-state/`. | Confusing UI state with runtime state. | Event routing demo; Use runtime state safely. |
| Event routing demo | Shows event movement through runtime. | Understand emitted events and listeners. | Event routing. | Event sources; payloads; routing; log. | Emit/listen/log excerpts. | Current at `/examples/event-routing/`. | Overusing events for direct local changes. | Pointer/input overlay; Route events. |
| Pointer/input overlay | Shows browser input with overlay feedback. | Connect input adapters to visible behavior. | Adapter contracts; Event routing. | Pointer adapter; input adapter; overlay; events; state. | Pointer/input excerpts. | Current at `/examples/pointer-input-overlay/`. | Coupling input handling to one renderer. | Scene/User Interface coordination. |
| Scene/User Interface coordination | Shows scene state connected to UI state. | Understand scene/UI bridge foundations. | Scene/User Interface bridge. | Scene surface; overlay UI; shared runtime state; events. | Scene/UI bridge excerpts. | Current at `/examples/scene-ui-bridge/`. | Describing URK as a game engine. | Playground starter; Bridge scene and User Interface. |
| Playground starter | Introduces the experimental runtime lab. | Understand playground scope. | Embed URK in a static website. | Editable schema/config; live preview; state; events; adapters; reset; sandboxing. | Playground host excerpts. | Experimental shell at `/playground/`. | Reading playground as a no-code builder. | Playground page; Deferred features. |

## Reference

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| @urk/core | Package reference for the kernel. | Find current kernel exports and boundaries. | Runtime kernel. | Responsibilities; exports; lifecycle; state; events; unstable notes. | Bootstrap snippets. | None. | Starting with reference before concepts. | Runtime types; Boundary. |
| @urk/adapters | Package reference for adapters. | Find current adapter capabilities. | Adapter contracts. | Current adapters; contracts; browser assumptions; status. | Adapter import/registration snippets. | None. | Assuming every adapter is stable. | Adapter contract types; Create an adapter. |
| @urk/examples | Reference for website-consumed examples. | Understand the internal example catalog. | Build a minimal runtime example. | Catalog; metadata; mount contract; private/internal warning. | `mount(host) => teardown` snippet. | Current examples index. | Treating `@urk/examples` as a stable public API too early. | Examples index. |
| @urk/react-urk | Package reference for the React wrapper. | Understand the publishable experimental React boundary. | Integration wrappers. | Provider; hooks; auto-boot; event subscription; no React-owned runtime. | Current provider and hook snippet. | None. | Starting URK architecture from React. | @urk/core; Use URK with React. |
| @urk/next-urk | Package reference for the Next.js wrapper. | Understand the publishable experimental Next.js client boundary. | @urk/react-urk. | Client boundary; `UrkNextProvider`; `useClientKernel`; React re-exports. | Current client-boundary snippet. | None. | Running browser runtime on the server. | @urk/react-urk; Use URK with Next.js. |
| CLI commands | Command-Line Interface reference. | Find current commands and status. | Installation. | Current commands; flags; outputs; planned commands. | `urk create`, `urk check`, `urk inspect` snippets only if shipped. | None. | Documenting planned commands as shipped. | Contributing; @urk/core. |
| Runtime types | Type reference for runtime objects. | Understand runtime type vocabulary. | Runtime context; Explicit runtime state. | Context; snapshot; lifecycle; scheduler; inspector. | Type usage snippets. | None. | Depending on unstable internal shapes without notes. | @urk/core; Error types. |
| Adapter contract types | Type reference for adapters. | Author adapters against correct contracts. | Adapter contracts. | Capability contracts; lifecycle; optional/required lookup; errors. | Typed adapter sketch. | None. | Leaking implementation-specific types into contracts. | @urk/adapters; Create an adapter. |
| Controller contract types | Type reference for controllers. | Write controllers that fit the lifecycle. | Controller lifecycle. | Registration; hooks; context access; cleanup. | Typed controller sketch. | None. | Assuming controllers own rendering. | Create a controller; Runtime types. |
| Event types | Type reference for runtime events. | Design event payloads clearly. | Event routing. | Base shape; source; payload; timestamp; logging. | Typed event definitions. | None. | Vague catch-all event names. | Route events; Error types. |
| Error types | Reference for runtime and adapter errors. | Handle failures predictably. | Runtime kernel; Adapter contracts. | Startup failures; missing capabilities; controller failures; recovery. | Error handling snippets. | None. | Swallowing runtime errors in UI code. | Deferred features; Contributing. |

## Project

| Page | Description | Reader goal | Prerequisites | Outline | Code examples needed | Live URK demo | Common mistakes | Next pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Boundary | States what URK owns and does not own. | Keep scope clear. | What URK is not. | Owned concerns; excluded concerns; red flags; examples. | Boundary matrix. | None. | Moving product logic into core. | Architecture; Decisions. |
| Architecture | Explains canonical layering. | Understand system structure. | Core mental model. | Kernel; adapters; controllers; state; scene/UI bridge; wrappers. | Folder layout and flow diagram. | Minimal Runtime link. | Treating wrappers as architecture source. | Decisions; Contributing. |
| Decisions | Records accepted architectural decisions. | Avoid repeated debate. | Architecture. | Runtime kernel not shell; standalone-first; adapters/controllers; one strong proof. | None. | None. | Changing architecture without checking decisions. | Deferred features; Roadmap. |
| Deferred features | Lists intentionally deferred scope. | Prevent roadmap drift. | Decisions. | Marketplace; no-code builder; large plugin system; devtools suite; integration matrix. | None. | None. | Treating deferred ideas as commitments. | Roadmap; Boundary. |
| Contributing | Guides open-source contribution. | Submit scoped, useful changes. | Boundary; Architecture. | Repo shape; docs expectations; examples; tests; review checklist. | PR checklist. | None. | Broad speculative changes without proof. | Roadmap; Decisions. |
| Roadmap | Shows sequence of maturity. | Understand what comes next. | Deferred features. | Current milestone; examples; playground; inspector; package hardening. | Milestone table. | None. | Reading roadmap as final API promise. | Build a minimal runtime example; Contributing. |

## Demo Policy

- Required live demos belong on example pages.
- Concept pages can embed small live demos when the demo directly teaches the concept.
- Reference pages should usually avoid live demos.
- Project pages should avoid live demos except links to proof surfaces.
- Future planned demos must be labeled planned or experimental.

## Diagram Policy

Use diagrams for:
- core mental model
- runtime kernel lifecycle
- runtime context access
- adapter registration and lookup
- controller lifecycle
- event routing
- scene/User Interface bridge
- static website embedding
- architecture layering

Diagrams should explain flow first, then point to code.

## Migration Notes

The current public docs in `apps/www/src/content/docs/docs/` cover the first minimal slice:
- docs home
- getting started
- runtime kernel
- adapters
- controllers
- state/events

This information architecture is the target structure. Add pages incrementally, starting with pages that unblock the example system and public contributor onboarding.
