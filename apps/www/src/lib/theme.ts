/**
 * Company: EonHive Inc.
 * Title: Theme Helpers
 * Purpose: Initialize and control the public website theme without depending on a framework runtime.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

const STORAGE_KEY = 'urk-theme';
const DARK = 'dark';
const LIGHT = 'light';

type ThemeName = typeof DARK | typeof LIGHT;

function getSystemTheme(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? LIGHT : DARK;
}

function isThemeName(value: string | null): value is ThemeName {
  return value === DARK || value === LIGHT;
}

function applyTheme(nextTheme: ThemeName): void {
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
}

function updateToggle(button: HTMLButtonElement, theme: ThemeName): void {
  const isLight = theme === LIGHT;

  button.setAttribute('aria-pressed', String(isLight));
  button.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
  button.querySelector('[data-role="theme-label"]')!.textContent = isLight ? 'Light' : 'Dark';
  button.querySelector('[data-role="theme-glyph"]')!.textContent = isLight ? '◐' : '◑';
}

export const themeInitScript = `
  (() => {
    const storageKey = '${STORAGE_KEY}';
    const root = document.documentElement;
    const stored = window.localStorage.getItem(storageKey);
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? '${LIGHT}' : '${DARK}';
    const theme = stored === '${LIGHT}' || stored === '${DARK}' ? stored : system;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  })();
`;

export function attachThemeToggles(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');

  if (buttons.length === 0) {
    return;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  let activeTheme: ThemeName = isThemeName(stored) ? stored : getSystemTheme();
  applyTheme(activeTheme);

  const syncButtons = (): void => {
    for (const button of buttons) {
      updateToggle(button, activeTheme);
    }
  };

  const onToggle = (): void => {
    activeTheme = activeTheme === DARK ? LIGHT : DARK;
    window.localStorage.setItem(STORAGE_KEY, activeTheme);
    applyTheme(activeTheme);
    syncButtons();
  };

  for (const button of buttons) {
    if (button.dataset.bound === 'true') {
      continue;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', onToggle);
  }

  syncButtons();
}
