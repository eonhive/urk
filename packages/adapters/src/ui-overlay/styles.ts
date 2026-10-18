/**
 * Company: EonHive Inc.
 * Title: Scoped Overlay Styles
 * Purpose: Ship optional presentation with the adapter's JavaScript build.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */

export const overlayStyles = `
[data-urk-overlay] {
  --urk-overlay-background: rgba(15, 23, 42, .92);
  --urk-overlay-status-background: rgba(15, 23, 42, .82);
  --urk-overlay-foreground: #f8fafc;
  --urk-overlay-muted: #cbd5e1;
  --urk-overlay-border: #64748b;
  --urk-overlay-active: rgba(14, 116, 144, .92);
  --urk-overlay-selected: rgba(22, 101, 52, .94);
  --urk-overlay-focus: #67e8f9;
}
[data-urk-ui-theme="light"] > [data-urk-overlay] {
  --urk-overlay-background: #f8fafc;
  --urk-overlay-status-background: #f8fafc;
  --urk-overlay-foreground: #0f172a;
  --urk-overlay-muted: #475569;
  --urk-overlay-border: #94a3b8;
  --urk-overlay-active: #cffafe;
  --urk-overlay-selected: #dcfce7;
  --urk-overlay-focus: #0e7490;
}
[data-urk-overlay] > .urk-overlay-layer {
  position: absolute; inset: 0; pointer-events: none;
  container: urk-overlay / size;
}
.urk-overlay-layer > .urk-overlay-slots {
  position: absolute; inset: 0; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  padding: var(--urk-ui-space, 16px); gap: 12px; box-sizing: border-box;
}
.urk-overlay-slots > .urk-overlay-slot {
  display: flex; flex-direction: column; gap: 8px; min-height: 0; min-width: 0;
  overflow: auto; scrollbar-width: thin;
}
.urk-overlay-slot:empty { display: none; }
.urk-overlay-slot[data-placement="top-start"] { grid-area: 1 / 1; align-items: flex-start; }
.urk-overlay-slot[data-placement="top-end"] { grid-area: 1 / 2; align-items: flex-end; }
.urk-overlay-slot[data-placement="bottom-start"] { grid-area: 2 / 1; align-items: flex-start; }
.urk-overlay-slot[data-placement="bottom-end"] { grid-area: 2 / 2; align-items: flex-end; }
/* Auto margins keep bottom alignment without pushing overflowing content above the scroll origin. */
.urk-overlay-slot[data-placement^="bottom-"] > .urk-overlay-item:first-child { margin-block-start: auto; }
.urk-overlay-slot > .urk-overlay-item {
  flex: 0 0 auto; width: min(100%, 320px); box-sizing: border-box;
  padding: var(--urk-ui-space, 16px); overflow-wrap: anywhere;
  color: var(--urk-ui-foreground, var(--urk-overlay-foreground));
  background: var(--urk-ui-background, var(--urk-overlay-background));
  border: 1px solid var(--urk-ui-border, var(--urk-overlay-border));
  border-radius: var(--urk-ui-radius, 12px);
  font: 14px/1.5 var(--urk-ui-font, system-ui, sans-serif);
}
.urk-overlay-item[data-tone="active"] { background: var(--urk-ui-active, var(--urk-overlay-active)); }
.urk-overlay-item[data-tone="selected"] { background: var(--urk-ui-selected, var(--urk-overlay-selected)); }
.urk-overlay-item > .urk-overlay-heading { display: flex; flex: 0 0 auto; justify-content: space-between; align-items: start; gap: 12px; }
.urk-overlay-heading > h3 { font: 600 15px/1.5 var(--urk-ui-font, system-ui, sans-serif); margin: 0; color: inherit; }
.urk-overlay-item > p { margin: 8px 0 0; color: inherit; }
.urk-overlay-item > progress { width: 100%; margin-top: 8px; accent-color: var(--urk-ui-accent, #0e7490); }
.urk-overlay-item[data-kind="panel"] {
  pointer-events: auto; display: flex; flex-direction: column;
  max-height: 100%; min-height: 0; overflow: hidden;
}
.urk-overlay-item > [data-overlay-content] {
  min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 4px;
}
.urk-overlay-heading > button {
  flex: 0 0 auto; min-height: 44px; min-width: 44px; border: 1px solid var(--urk-ui-border, var(--urk-overlay-border));
  border-radius: 6px; padding: 4px 8px; background: transparent; color: inherit;
  font: inherit; cursor: pointer;
}
.urk-overlay-item :focus-visible { outline: 2px solid var(--urk-ui-focus, var(--urk-overlay-focus)); outline-offset: 2px; }
@container urk-overlay (max-width: 520px) or (max-height: 360px) {
  .urk-overlay-layer > .urk-overlay-slots { display: flex; flex-direction: column; overflow: auto; }
  .urk-overlay-slots > .urk-overlay-slot { flex: 0 0 auto; overflow: visible; align-items: stretch; }
  .urk-overlay-slot > .urk-overlay-item { width: 100%; }
  .urk-overlay-slot[data-placement^="bottom-"] > .urk-overlay-item:first-child { margin-block-start: 0; }
  .urk-overlay-slot > .urk-overlay-item[data-kind="panel"] { max-height: calc(100cqh - 2 * var(--urk-ui-space, 16px)); }
}
`;
