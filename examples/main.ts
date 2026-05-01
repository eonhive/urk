/**
 * Company: EonHive Inc.
 * Title: URK Examples Router
 * Purpose: Provide a lightweight landing page that links to every standalone URK example.
 * Author: Stan Nesi
 * Created: 2026-04-29
 * Updated: 2026-04-29
 * Notes: Vibe coded with Codex.
 */

type ExampleId =
  | 'picking'
  | 'audio'
  | 'loading-transition'
  | 'app-shell'
  | 'react-starter'
  | 'scrollytelling'
  | 'runtime-inspector';

type ExampleEntry = {
  id: ExampleId;
  title: string;
  category: string;
  description: string;
  routeHref: string;
  routeLabel: string;
  tags: string[];
};

const EXAMPLES: ExampleEntry[] = [
  {
    id: 'picking',
    title: 'Picking Proof',
    category: 'Scene + UI',
    description:
      'DOM targets, Three scene picking, keyboard movement, persistence, and overlay feedback sharing one state model.',
    routeHref: './picking/',
    routeLabel: '/picking/',
    tags: ['three', 'pointer', 'input', 'storage'],
  },
  {
    id: 'audio',
    title: 'Audio Proof',
    category: 'Transport',
    description:
      'Browser-native transport controls with staged loading, mute and volume, pause and resume, and shutdown behavior.',
    routeHref: './audio-proof/',
    routeLabel: '/audio-proof/',
    tags: ['audio', 'loading', 'pointer', 'input'],
  },
  {
    id: 'loading-transition',
    title: 'Loading Transition',
    category: 'Lifecycle',
    description:
      'DOM-first runtime handoff proving staged loading, timed transition, replay, and clean pause and resume.',
    routeHref: './loading-transition/',
    routeLabel: '/loading-transition/',
    tags: ['loading', 'transition', 'ui-widgets'],
  },
  {
    id: 'app-shell',
    title: 'App Shell',
    category: 'Orchestration',
    description:
      'A generic runtime shell with pointer and keyboard navigation, persisted layout chrome, and lifecycle-safe controls.',
    routeHref: './app-shell/',
    routeLabel: '/app-shell/',
    tags: ['storage', 'input', 'pointer', 'ui-widgets'],
  },
  {
    id: 'react-starter',
    title: 'React Starter',
    category: 'Wrapper',
    description:
      'React consuming an existing URK kernel through the thin provider, runtime phase hooks, and kernel-event helpers.',
    routeHref: './react-starter/',
    routeLabel: '/react-starter/',
    tags: ['react', 'loading', 'events'],
  },
  {
    id: 'scrollytelling',
    title: 'Scrollytelling',
    category: 'Motion',
    description:
      'A DOM-first story surface with explicit section state, internal scrolling, keyboard jumps, and pause-safe motion.',
    routeHref: './scrollytelling/',
    routeLabel: '/scrollytelling/',
    tags: ['scroll', 'input', 'pointer', 'ui-widgets'],
  },
  {
    id: 'runtime-inspector',
    title: 'Runtime Inspector',
    category: 'Diagnostics',
    description:
      'A thin read-only kernel diagnostics proof for runtime state, scheduler activity, registries, services, and recent events.',
    routeHref: './runtime-inspector/',
    routeLabel: '/runtime-inspector/',
    tags: ['inspection', 'loading', 'input', 'events'],
  },
];


function assertElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Missing DOM element: ${label}`);
  }

  return value;
}

function renderPreview(entry: ExampleEntry): string {
  switch (entry.id) {
    case 'picking':
      return `
        <div class="examples-preview examples-preview--picking" aria-hidden="true">
          <span class="examples-preview__frame"></span>
          <span class="examples-preview__mesh examples-preview__mesh--a"></span>
          <span class="examples-preview__mesh examples-preview__mesh--b"></span>
          <span class="examples-preview__pill examples-preview__pill--a"></span>
          <span class="examples-preview__pill examples-preview__pill--b"></span>
        </div>
      `;
    case 'audio':
      return `
        <div class="examples-preview examples-preview--audio" aria-hidden="true">
          <span class="examples-preview__wave"></span>
          <span class="examples-preview__bar examples-preview__bar--1"></span>
          <span class="examples-preview__bar examples-preview__bar--2"></span>
          <span class="examples-preview__bar examples-preview__bar--3"></span>
          <span class="examples-preview__bar examples-preview__bar--4"></span>
        </div>
      `;
    case 'loading-transition':
      return `
        <div class="examples-preview examples-preview--loading" aria-hidden="true">
          <span class="examples-preview__track"></span>
          <span class="examples-preview__fill"></span>
          <span class="examples-preview__veil"></span>
          <span class="examples-preview__panel"></span>
        </div>
      `;
    case 'app-shell':
      return `
        <div class="examples-preview examples-preview--shell" aria-hidden="true">
          <span class="examples-preview__sidebar"></span>
          <span class="examples-preview__topbar"></span>
          <span class="examples-preview__card examples-preview__card--a"></span>
          <span class="examples-preview__card examples-preview__card--b"></span>
          <span class="examples-preview__card examples-preview__card--c"></span>
        </div>
      `;
    case 'react-starter':
      return `
        <div class="examples-preview examples-preview--react" aria-hidden="true">
          <span class="examples-preview__halo"></span>
          <span class="examples-preview__component examples-preview__component--a"></span>
          <span class="examples-preview__component examples-preview__component--b"></span>
          <span class="examples-preview__component examples-preview__component--c"></span>
        </div>
      `;
    case 'scrollytelling':
      return `
        <div class="examples-preview examples-preview--story" aria-hidden="true">
          <span class="examples-preview__rail"></span>
          <span class="examples-preview__chapter examples-preview__chapter--1"></span>
          <span class="examples-preview__chapter examples-preview__chapter--2"></span>
          <span class="examples-preview__chapter examples-preview__chapter--3"></span>
        </div>
      `;
    case 'runtime-inspector':
      return `
        <div class="examples-preview examples-preview--inspector" aria-hidden="true">
          <span class="examples-preview__console"></span>
          <span class="examples-preview__metric examples-preview__metric--1"></span>
          <span class="examples-preview__metric examples-preview__metric--2"></span>
          <span class="examples-preview__metric examples-preview__metric--3"></span>
          <span class="examples-preview__log examples-preview__log--1"></span>
          <span class="examples-preview__log examples-preview__log--2"></span>
          <span class="examples-preview__log examples-preview__log--3"></span>
        </div>
      `;
  }
}

function renderExampleCards(container: HTMLElement): void {
  container.innerHTML = EXAMPLES.map((entry) => {
    return `
      <article class="examples-card">
        <div class="examples-card__head">
          <span class="examples-card__category">${entry.category}</span>
          <span class="examples-card__route">${entry.routeLabel}</span>
        </div>
        ${renderPreview(entry)}
        <div class="examples-card__body">
          <div>
            <h2>${entry.title}</h2>
          </div>
          <p>${entry.description}</p>
          <div class="examples-card__tags">
            ${entry.tags
              .map((tag) => `<span class="examples-card__tag">${tag}</span>`)
              .join('')}
          </div>
          <a class="examples-card__cta" href="${entry.routeHref}">Open proof</a>
        </div>
      </article>
    `;
  }).join('');
}

function main(): void {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (!app) {
    throw new Error('Missing #app root for the URK examples router.');
  }
  const examplesGrid = assertElement(
    app.querySelector<HTMLElement>('[data-role="examples-grid"]'),
    'examples grid',
  );
  renderExampleCards(examplesGrid);
}

main();
