/**
 * Company: EonHive Inc.
 * Title: Brand Data
 * Purpose: Hold the canonical URK brand system content, asset references, and usage rules for the public site.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

export type BrandThemeName = 'dark' | 'light';

export type BrandTokenEntry = {
  label: string;
  token: string;
  value: string;
  role: string;
};

export type BrandDownloadEntry = {
  label: string;
  href: string;
  note: string;
};

export type BrandIconEntry = {
  label: string;
  href: string;
  note: string;
};

export const brandApprovedPhrases = [
  'Not another framework.',
  'A small runtime layer for big browser surfaces.',
  'Runtime UI, without framework lock-in.',
  'Declarative layouts. Runtime execution. Interactive UI.',
  'Data in. Experience out.',
  'Built for browser-native interactive systems.',
] as const;

export const brandLogoRules = {
  clearSpace: 'Use one monogram module of clear space on every side of the wordmark, lockups, and app icon.',
  minimumSizes: [
    'Wordmark: 72px minimum width.',
    'Full lockup: 160px minimum width.',
    'Monogram: 18px minimum size.',
    'App icon: 24px minimum size.',
  ],
} as const;

export const brandPalettes: Record<BrandThemeName, BrandTokenEntry[]> = {
  dark: [
    { label: 'Background', token: '--urk-background', value: '#090C14', role: 'Near-black midnight canvas.' },
    { label: 'Elevated', token: '--urk-background-elevated', value: '#0F1520', role: 'Dark shell lift for layered surfaces.' },
    { label: 'Surface', token: '--urk-surface', value: '#131A26', role: 'Primary panel background.' },
    { label: 'Strong Surface', token: '--urk-surface-strong', value: '#1A2332', role: 'Dense panel or emphasis surface.' },
    { label: 'Border', token: '--urk-border', value: 'rgba(86, 98, 121, 0.55)', role: 'Slate structural border.' },
    { label: 'Foreground', token: '--urk-foreground', value: '#E8ECF3', role: 'Primary text and linework.' },
    { label: 'Muted', token: '--urk-muted', value: '#96A0B4', role: 'Secondary text and passive chrome.' },
    { label: 'Primary', token: '--urk-primary', value: '#7B61FF', role: 'Kernel identity and active system state.' },
    { label: 'Runtime', token: '--urk-success', value: '#2FCB7A', role: 'Runtime progress and success signals.' },
    { label: 'Adapter', token: '--urk-warning', value: '#D9A441', role: 'Adapter or caution emphasis.' },
    { label: 'Error', token: '--urk-error', value: '#E05666', role: 'Failure or invalid state.' },
  ],
  light: [
    { label: 'Background', token: '--urk-background', value: '#F6F1E8', role: 'Off-white reading canvas.' },
    { label: 'Elevated', token: '--urk-background-elevated', value: '#FCFAF5', role: 'Soft lifted page background.' },
    { label: 'Surface', token: '--urk-surface', value: '#FFFFFF', role: 'Primary light surface.' },
    { label: 'Strong Surface', token: '--urk-surface-strong', value: '#EFE8DC', role: 'Structural cards and rails.' },
    { label: 'Border', token: '--urk-border', value: 'rgba(126, 142, 164, 0.32)', role: 'Light slate border.' },
    { label: 'Foreground', token: '--urk-foreground', value: '#161C28', role: 'Deep graphite text.' },
    { label: 'Muted', token: '--urk-muted', value: '#5E6A7C', role: 'Secondary text and passive chrome.' },
    { label: 'Primary', token: '--urk-primary', value: '#6C4DFF', role: 'Kernel identity and active system state.' },
    { label: 'Runtime', token: '--urk-success', value: '#1F9A5F', role: 'Runtime progress and success signals.' },
    { label: 'Adapter', token: '--urk-warning', value: '#B7791F', role: 'Adapter or caution emphasis.' },
    { label: 'Error', token: '--urk-error', value: '#C6404C', role: 'Failure or invalid state.' },
  ],
};

export const brandTypography = {
  display: 'Space Grotesk',
  body: 'Geist',
  code: 'IBM Plex Mono',
  rules: [
    'Hero headings use the display face, tight tracking, and compact line-height.',
    'Section headings use the display face at one step calmer than the hero.',
    'Body text uses the UI sans with generous line-height and neutral rhythm.',
    'Navigation and badges stay compact, uppercase or semi-condensed, and structural.',
    'Code always uses the mono face on the darker code surface in both themes.',
  ],
} as const;

export const brandUiPrimitives = [
  'Primary button',
  'Secondary button',
  'Ghost button',
  'Navigation bar',
  'Feature card',
  'Package card',
  'Code block',
  'Input field',
  'Select field',
  'Status badge',
  'Event log item',
  'Tab control',
  'Theme toggle',
  'Callout',
  'Docs sidebar item',
] as const;

export const brandLogoDownloads: BrandDownloadEntry[] = [
  { label: 'Wordmark on dark', href: '/brand/logos/urk-wordmark-on-dark.svg', note: 'Use on dark or saturated backgrounds.' },
  { label: 'Wordmark on light', href: '/brand/logos/urk-wordmark-on-light.svg', note: 'Use on light or pale backgrounds.' },
  { label: 'Horizontal lockup on dark', href: '/brand/logos/urk-lockup-horizontal-on-dark.svg', note: 'Wordmark plus expansion for dark surfaces.' },
  { label: 'Horizontal lockup on light', href: '/brand/logos/urk-lockup-horizontal-on-light.svg', note: 'Wordmark plus expansion for light surfaces.' },
  { label: 'Stacked lockup on dark', href: '/brand/logos/urk-lockup-stacked-on-dark.svg', note: 'Vertical brand lockup for centered compositions.' },
  { label: 'Stacked lockup on light', href: '/brand/logos/urk-lockup-stacked-on-light.svg', note: 'Vertical brand lockup for light surfaces.' },
  { label: 'Monogram on dark', href: '/brand/logos/urk-monogram-on-dark.svg', note: 'Minimal kernel mark for dark surfaces.' },
  { label: 'Monogram on light', href: '/brand/logos/urk-monogram-on-light.svg', note: 'Minimal kernel mark for light surfaces.' },
  { label: 'App icon', href: '/brand/logos/urk-app-icon.svg', note: 'Dark rounded square app icon with violet kernel node.' },
];

export const brandIcons: BrandIconEntry[] = [
  { label: 'Runtime kernel', href: '/brand/icons/runtime-kernel.svg', note: 'The kernel as the orchestration center of gravity.' },
  { label: 'Component registry', href: '/brand/icons/component-registry.svg', note: 'Named capability lookup and registration.' },
  { label: 'Adapter', href: '/brand/icons/adapter.svg', note: 'Browser capability bridge and contract edge.' },
  { label: 'Controller', href: '/brand/icons/controller.svg', note: 'Explicit orchestration unit.' },
  { label: 'State', href: '/brand/icons/state.svg', note: 'Explicit runtime state container.' },
  { label: 'Event bus', href: '/brand/icons/event-bus.svg', note: 'Routed event flow through the runtime.' },
  { label: 'Layout tree', href: '/brand/icons/layout-tree.svg', note: 'Hierarchical runtime structure.' },
  { label: 'Schema document', href: '/brand/icons/schema-document.svg', note: 'Structured runtime input as data.' },
  { label: 'Browser surface', href: '/brand/icons/browser-surface.svg', note: 'Mounted browser-native interface.' },
  { label: 'CLI', href: '/brand/icons/cli.svg', note: 'Command-line tooling surface.' },
  { label: 'Package', href: '/brand/icons/package.svg', note: 'Composable package boundary.' },
  { label: 'Playground', href: '/brand/icons/playground.svg', note: 'Experimental runtime workspace.' },
];

export const brandUsageNotes = [
  'Use `uRK` for public-facing brand expression and `URK` for package names, code-facing prose, and expansions.',
  'Reserve violet for kernel identity and active system states, not generic decoration.',
  'Keep layout geometry orthogonal and structural. Prefer grid, line, and node motifs over soft blobs.',
  'Use real runtime examples and diagrams instead of fake dashboards or no-code-builder cues.',
  'Keep copy declarative and technical. The brand should feel serious, minimal, and open-source.',
] as const;

export const brandMisuseNotes = [
  'Do not present URK as a full application framework.',
  'Do not use playful SaaS gradients, mascots, or glossy dashboard patterns.',
  'Do not frame URK as a game engine, crypto product, or AI-hype platform.',
  'Do not replace the monogram with circles, orbits, sparks, or unrelated abstract symbols.',
  'Do not treat the public brand system as a substitute for the runtime boundary.',
] as const;
