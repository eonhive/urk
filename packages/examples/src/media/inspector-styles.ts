/**
 * Company: EonHive Inc. | Title: Media Inspector Styles
 * Purpose: Keep optional diagnostics readable within the existing media presentations.
 * Author: Stan Nesi | Created: 2026-10-15 | Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */
export const mediaInspectorStyles = `
.urk-media-inspector {
  margin-top: 24px;
  padding: 18px;
  color: var(--urk-foreground, #e4edf9);
  background: var(--urk-surface, #0c1d2c);
  border: 1px solid var(--urk-border, #24394a);
  border-radius: 10px;
  max-height: min(560px, 75svh);
  overflow: auto;
  overflow-wrap: anywhere;
  font: 12px/1.6 var(--urk-font-body, system-ui);
}
.urk-media-inspector[hidden] { display: none; }
.urk-media-inspector:focus-visible { outline: 2px solid var(--urk-cyan, #55e3eb); outline-offset: 3px; }
.media-journey .urk-media-inspector { margin: 0 0 24px; }
.urk-media-inspector h3 { margin: 0 0 18px; font-size: 18px; letter-spacing: 0; }
.urk-media-inspector h3 span { color: var(--urk-cyan, #55e3eb); font: 10px var(--urk-font-code, monospace); margin-left: 8px; }
.urk-media-inspector h4 { margin: 20px 0 8px; font-size: 12px; }
.urk-media-inspector dl { display: grid; grid-template-columns: minmax(70px, 1fr) minmax(0, 2fr); gap: 6px 12px; margin: 0 0 16px; }
.urk-media-inspector dt, .urk-media-inspector p { color: var(--urk-muted, #9aafc5); }
.urk-media-inspector dd { margin: 0; }
.urk-media-inspector ul, .urk-media-inspector ol { list-style: none; margin: 0; padding: 0; }
.urk-media-inspector ul > li { border-top: 1px solid var(--urk-border, #24394a); padding-top: 12px; }
.urk-media-inspector strong { display: block; margin-bottom: 8px; color: var(--urk-cyan, #55e3eb); }
.urk-media-inspector ol { font: 11px/1.8 var(--urk-font-code, monospace); }
.urk-media-inspector p { margin: 16px 0 0; font-size: 11px; }
`;
