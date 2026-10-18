/**
 * Company: EonHive Inc.
 * Title: Selection Example Views
 * Purpose: Present scene nodes and webpage cards with the same scoped details layout.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

export type SelectionMode = 'scene' | 'projects';
export const items = [
  { id: 'orbit', title: 'Orbit' }, { id: 'prism', title: 'Prism' }, { id: 'grove', title: 'Grove' },
];

const styles = `
.selection-proof { container: selection-proof / inline-size; width: 100%; max-width: 1100px; margin: 0 auto; padding: 16px; box-sizing: border-box; border-radius: 16px; background: #111827; color: #e2e8f0; font: 15px/1.6 system-ui; }
.selection-proof[data-compact="true"] { max-width: 420px; }
.selection-proof[data-theme="light"] { background: #f1f5f9; color: #0f172a; }
.selection-proof .selection-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 20px; }
.selection-proof button, .selection-proof select { font: inherit; cursor: pointer; min-height: 44px; padding: 8px 12px; border-radius: 8px; border: 1px solid #64748b; color: inherit; background: transparent; }
.selection-proof button:disabled { opacity: .55; cursor: default; }
.selection-proof button:focus-visible, .selection-proof select:focus-visible { outline: 3px solid #0e7490; outline-offset: 3px; }
.selection-proof .selection-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-block: 16px; align-items: center; }
.selection-proof .selection-items { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; min-height: 260px; padding: 20px; background: #0f172a; border-radius: 16px; align-items: center; }
.selection-proof [data-select] { min-width: 0; min-height: 110px; color: #e2e8f0; border: 2px solid #64748b; background: #1e293b; overflow-wrap: anywhere; }
.selection-proof [data-mode="scene"] [data-select] { border-radius: 50%; aspect-ratio: 1; min-height: 0; background: radial-gradient(circle at 30% 25%, #155e75, #1e293b); }
.selection-proof [data-select][aria-pressed="true"] { border-color: #67e8f9; }
.selection-proof [data-select][data-highlight="true"] { background: #4c1d95; box-shadow: inset 0 0 0 5px #c4b5fd; }
.selection-proof [data-overlay-host] { position: relative; min-height: 590px; }
.selection-proof [data-overlay-status]:empty { display: none; }
.selection-proof [data-kind="panel"] button { margin: 4px 8px 4px 0; }
.selection-proof [data-example-message] { min-height: 26px; }
@container selection-proof (max-width: 760px) {
  .selection-proof .selection-layout { grid-template-columns: minmax(0, 1fr); }
  .selection-proof .selection-items { min-height: 200px; padding: 12px; }
}
`;

export function createSelectionView(mode: SelectionMode): HTMLElement {
  const root = document.createElement('section');
  root.className = 'selection-proof';
  root.dataset.theme = 'dark';
  root.setAttribute('aria-label', mode === 'scene' ? 'Scene selection' : 'Project selection');
  root.innerHTML = `<style>${styles}</style>
    <div class="selection-toolbar" role="group" aria-label="Presentation controls">
      <button type="button" data-theme-toggle>Use light theme</button>
      <button type="button" data-compact-toggle aria-pressed="false">Compact host</button>
      <button type="button" data-fail-details>Try details failure</button>
    </div>
    <div class="selection-layout">
      <div><div class="selection-items" data-mode="${mode}" role="group" aria-label="${mode === 'scene' ? 'Scene nodes' : 'Projects'}">
        ${items.map(item => `<button type="button" data-select="${item.id}" aria-pressed="false">${item.title}</button>`).join('')}
      </div><p data-selected-label>Choose an item to view its details.</p><p>Close the details panel to keep exploring. The selection stays in this view.</p></div>
      <div data-overlay-host data-urk-ui-theme="dark"></div>
    </div><p data-example-message role="status"></p>`;
  return root;
}
