/**
 * Company: EonHive Inc.
 * Title: Playground Styles
 * Purpose: Share responsive playground presentation across every host.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

export const styles = `
.urk-v02 {
  --demo-bg: var(--urk-background, #06101b);
  --demo-panel: var(--urk-surface, #0c1d2c);
  --demo-line: var(--urk-border, #20384b);
  --demo-text: var(--urk-foreground, #e4edf9);
  --demo-muted: var(--urk-muted, #9aafc5);
  --demo-accent: var(--urk-cyan, #35dff2);
  color: var(--demo-text);
  font: 14px/1.5 var(--urk-font-body, system-ui);
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 0 16px;
  padding: 24px;
  box-sizing: border-box;
}
.urk-v02 * {
  box-sizing: border-box;
}
.urk-v02 .v02-controls-host,
.urk-v02 .workbench-controls {
  display: contents;
}
.urk-v02 .workbench-heading {
  grid-column: 1/-1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.urk-v02 h1 {
  font: 600 clamp(26px, 4vw, 36px)/1.2 var(--urk-font-display, system-ui);
  letter-spacing: -1.5px;
  margin: 8px 0;
}
.urk-v02 .eyebrow {
  color: var(--demo-accent);
  font-size: 10px;
  letter-spacing: 2px;
  font-weight: 600;
}
.urk-v02 .workbench-heading p {
  color: var(--demo-muted);
  margin: 8px 0 0;
  font-size: 13px;
}
.urk-v02 .version-badge {
  font: 11px var(--urk-font-code, monospace);
  border: 1px solid var(--demo-line);
  padding: 4px 6px;
  border-radius: 4px;
  vertical-align: middle;
  margin-left: 12px;
  color: var(--demo-muted);
  letter-spacing: 0;
}
.urk-v02 .workbench-badge {
  color: var(--demo-accent);
  border: 1px solid var(--demo-line);
  border-radius: 5px;
  padding: 7px 10px;
  font-size: 9px;
  letter-spacing: 1.2px;
  white-space: nowrap;
}
.urk-v02 .toolbar {
  grid-column: 1/-1;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
  background: var(--demo-panel);
  border: 1px solid var(--demo-line);
  border-radius: 9px;
  padding: 9px;
}
.urk-v02 .workspace-label {
  margin-right: auto;
  color: var(--demo-muted);
  padding: 0 8px;
  font-size: 12px;
}
.urk-v02 button {
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--demo-line);
  border-radius: 6px;
  background: var(--demo-panel);
  color: var(--demo-text);
  padding: 9px 12px;
  min-height: 40px;
  cursor: pointer;
}
.urk-v02 button:hover:not(:disabled) {
  border-color: var(--demo-accent);
  background: color-mix(in srgb, var(--demo-accent) 8%, var(--demo-panel));
}
.urk-v02 button:focus-visible,
.urk-v02 input:focus-visible,
.urk-v02 .viewport:focus-visible {
  outline: 2px solid var(--demo-accent);
  outline-offset: 3px;
}
.urk-v02 button:disabled,
.urk-v02 input:disabled {
  opacity: 0.4;
  cursor: default;
}
.urk-v02 [data-action="restart"] {
  background: linear-gradient(110deg, #35e6ef, #c08aff);
  color: #071522;
  border-color: transparent;
  font-weight: 600;
}
.urk-v02 .workbench-inspector {
  grid-column: 2;
  grid-row: 3;
  align-self: start;
  background: var(--demo-panel);
  border: 1px solid var(--demo-line);
  border-radius: 9px;
  overflow: hidden;
  padding: 16px;
}
.urk-v02 .workbench-inspector h2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 16px;
}
.urk-v02 .workbench-inspector h2 span {
  font-size: 8px;
  letter-spacing: 1px;
  color: var(--demo-accent);
}
.urk-v02 .metrics {
  display: grid;
  gap: 14px;
  border-block: 1px solid var(--demo-line);
  padding: 16px 0;
}
.urk-v02 .metrics > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.urk-v02 .metrics span {
  color: var(--demo-muted);
  font-size: 11px;
}
.urk-v02 output {
  display: block;
  color: var(--demo-accent);
  font-weight: 500;
  font-size: 11px;
}
.urk-v02 [data-state="failed"],
.urk-v02 [data-testid="v02-message"] {
  color: var(--urk-error, #ff8585);
}
.urk-v02 .inspector-note {
  padding-block: 18px;
  color: var(--demo-muted);
  font-size: 11px;
}
.urk-v02 .inspector-note strong {
  color: var(--demo-text);
  font-weight: 500;
}
.urk-v02 .inspector-note p {
  margin: 6px 0 0;
  line-height: 1.8;
}
.urk-v02 .workbench-inspector h3 {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--demo-muted);
  margin: 0 0 10px;
}
.urk-v02 .inspector-actions {
  display: grid;
  gap: 8px;
}
.urk-v02 .inspector-actions button {
  text-align: left;
  font-size: 11px;
}
.urk-v02 .v02-surface-host {
  grid-column: 1;
  grid-row: 3;
  min-width: 0;
}
.urk-v02 .surface {
  position: relative;
}
.urk-v02 .scene-shell {
  position: relative;
  border: 1px solid #25415b;
  border-radius: 9px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 15% 45%, #1bbbe71a, transparent 50%),
    radial-gradient(ellipse at 80% 55%, #7952c62b, transparent 50%),
    linear-gradient(150deg, #10263a, #06101b);
}
.urk-v02 .scene-topline {
  display: flex;
  justify-content: space-between;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 14px 16px;
  color: #91b2cb;
  font-size: 9px;
  letter-spacing: 1px;
  pointer-events: none;
  z-index: 1;
}
.urk-v02 .scene-topline span:last-child {
  background: #35dff2;
  color: #06101b;
  padding: 3px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.urk-v02 .viewport {
  height: 400px;
  touch-action: pan-y;
}
.urk-v02 .scene-overlay {
  position: absolute;
  inset: 30px 0 0;
  pointer-events: none;
}
.urk-v02 .scene-caption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--demo-muted);
  font-size: 10px;
  margin: 12px 2px;
}
.urk-v02 kbd {
  border: 1px solid var(--demo-line);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--demo-text);
  font: inherit;
}
.urk-v02 .cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 16px 0;
}
.urk-v02 .cards button {
  position: relative;
  min-height: 88px;
  text-align: left;
  padding: 14px;
  background: var(--demo-panel);
}
.urk-v02 .choice-number {
  float: right;
  font: 10px var(--urk-font-code, monospace);
  color: var(--demo-muted);
}
.urk-v02 .cards strong {
  display: block;
  font-size: 16px;
  color: var(--demo-text);
  font-family: var(--urk-font-display, system-ui);
}
.urk-v02 .cards small {
  color: var(--demo-muted);
  font-size: 11px;
}
.urk-v02 .cards button[aria-pressed="true"] {
  border-color: var(--demo-accent);
  background: color-mix(in srgb, var(--demo-accent) 8%, var(--demo-panel));
  box-shadow: inset 0 2px var(--demo-accent);
}
.urk-v02 .interaction-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid var(--demo-line);
  padding-top: 16px;
}
.urk-v02 .volume {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--demo-muted);
  font-size: 11px;
}
.urk-v02 input[type="range"] {
  width: 100px;
  accent-color: var(--demo-accent);
  min-height: 32px;
}
.urk-v02 .local-status {
  color: var(--demo-muted);
  font-size: 11px;
  flex-basis: 100%;
  font-weight: 400;
  min-height: 18px;
}
.urk-v02 .storage-label {
  margin-left: auto;
  font-size: 10px;
  color: var(--demo-muted);
}
.urk-v02 pre {
  white-space: pre-wrap;
  color: var(--demo-muted);
  font-size: 10px;
  margin: 12px 0 0;
  overflow-wrap: anywhere;
}
.urk-v02 [data-testid="v02-message"]:empty {
  display: none;
}
.urk-v02 .surface[data-paused="true"] .viewport {
  opacity: 0.55;
  cursor: default;
}
@media (max-width: 800px) {
  .urk-v02 {
    grid-template-columns: 1fr;
    padding: 16px;
  }
  .urk-v02 .workbench-inspector {
    grid-column: 1;
    grid-row: 4;
    margin-top: 20px;
  }
  .urk-v02 .metrics {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px 32px;
  }
  .urk-v02 .inspector-actions {
    grid-template-columns: repeat(3, 1fr);
  }
  .urk-v02 .inspector-note {
    padding-block: 12px;
  }
  .urk-v02 .workbench-badge {
    display: none;
  }
  .urk-v02 .viewport {
    height: 320px;
  }
}
@media (max-width: 480px) {
  .urk-v02 {
    padding: 12px;
  }
  .urk-v02 .workbench-heading p {
    max-width: 32ch;
  }
  .urk-v02 .workspace-label {
    flex-basis: 100%;
    padding-block: 4px;
  }
  .urk-v02 .toolbar button {
    flex: 1;
    min-height: 44px;
  }
  .urk-v02 .viewport {
    height: 270px;
  }
  .urk-v02 .cards button {
    padding: 12px 9px;
    min-height: 86px;
  }
  .urk-v02 .cards strong {
    font-size: 14px;
  }
  .urk-v02 .cards small {
    font-size: 10px;
  }
  .urk-v02 .choice-number {
    float: none;
    display: block;
    margin-bottom: 6px;
    font-size: 8px;
  }
  .urk-v02 .storage-label {
    margin-left: 0;
  }
  .urk-v02 .inspector-actions {
    grid-template-columns: 1fr;
  }
  .urk-v02 .inspector-actions button {
    min-height: 44px;
  }
  .urk-v02 .metrics {
    gap: 12px;
  }
}
`;
