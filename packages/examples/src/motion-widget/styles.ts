/*
Company: EonHive Inc. | Title: Embedded Motion Widget Styles
Purpose: Style the reusable widget without changing its host's elements.
Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-18
Notes: Vibe coded with Codex.
*/
export const motionWidgetStyles = `
.umw,
.umw * {
  box-sizing: border-box;
}
.umw {
  --umw-accent: #7ce8e3;
  min-width: 0;
  margin: 0;
  padding: 26px;
  border: 1px solid #2d374b;
  border-radius: 18px;
  background: #101725;
  color: #ecf0fb;
  font:
    14px/1.5 system-ui,
    sans-serif;
}
.umw[data-tone='violet'] {
  --umw-accent: #b8a3ff;
}
.umw-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}
.umw h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.7px;
}
.umw-status {
  color: var(--umw-accent);
  font:
    11px ui-monospace,
    monospace;
}
.umw-intro {
  margin: 6px 0 28px;
  color: #a4afc3;
}
.umw-art {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  min-height: 132px;
}
.umw-tile {
  border: 1px solid #364258;
  border-radius: 11px;
  background: #192335;
  text-align: center;
  padding: 12px 4px;
}
.umw-tile i {
  display: block;
  font:
    normal 48px/1.5 system-ui,
    sans-serif;
  color: var(--umw-accent);
}
.umw-tile span {
  font-size: 11px;
  color: #d2d9e8;
}
.umw-result {
  padding-block: 20px;
  color: var(--umw-accent);
  font-size: 12px;
}
.umw-progress {
  display: block;
  width: 100%;
  height: 5px;
  accent-color: var(--umw-accent);
}
.umw-visibility {
  margin: 0 0 10px;
  color: #a4afc3;
  font-size: 11px;
}
.umw-time {
  display: block;
  margin-bottom: 10px;
  color: #a4afc3;
  font:
    11px ui-monospace,
    monospace;
  font-variant-numeric: tabular-nums;
}
.umw-scrub {
  display: block;
  margin-top: 16px;
  color: #a4afc3;
  font-size: 12px;
}
.umw-scrub input {
  display: block;
  width: 100%;
  height: 26px;
  margin: 8px 0 0;
  accent-color: var(--umw-accent);
  cursor: pointer;
}
.umw-scrub input:focus-visible {
  outline: 2px solid var(--umw-accent);
  outline-offset: 4px;
}
.umw-scrub input:disabled {
  opacity: 0.4;
  cursor: default;
}
.umw-scrub-hint {
  margin: 4px 0 0;
  color: #a4afc3;
  font-size: 11px;
}
.umw-speed {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
  color: #a4afc3;
  font-size: 12px;
}
.umw-speed select {
  min-width: 0;
  max-width: 100%;
  padding: 8px 10px;
  border: 1px solid #46536a;
  border-radius: 6px;
  background: #0a1020;
  color: #e9f1fc;
  font:
    12px system-ui,
    sans-serif;
}
.umw-speed select:focus-visible {
  outline: 2px solid var(--umw-accent);
  outline-offset: 4px;
}
.umw-timing {
  margin-top: 18px;
  border-top: 1px solid #364258;
  padding-top: 14px;
  font-size: 12px;
}
.umw-timing summary {
  cursor: pointer;
}
.umw-timing summary:focus-visible,
.umw-timing input:focus-visible {
  outline: 2px solid var(--umw-accent);
  outline-offset: 4px;
}
.umw-timing fieldset {
  min-width: 0;
  margin: 16px 0 0;
  padding: 0;
  border: 0;
}
.umw-timing fieldset:disabled {
  opacity: 0.5;
}
.umw-timing legend {
  padding: 0 0 12px;
  color: var(--umw-accent);
}
.umw-timing-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.umw-timing-fields label {
  min-width: 0;
  color: #a4afc3;
  font-size: 11px;
}
.umw-timing input {
  display: block;
  width: 100%;
  margin-top: 7px;
  padding: 9px 7px;
  border: 1px solid #46536a;
  border-radius: 6px;
  background: #0a1020;
  color: #e9f1fc;
  font:
    12px system-ui,
    sans-serif;
}
.umw-timing p {
  color: #a4afc3;
  font-size: 11px;
}
.umw-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}
.umw button {
  padding: 9px 11px;
  border: 1px solid #46536a;
  border-radius: 7px;
  background: #1a2537;
  color: #e9f1fc;
  font:
    12px/1.4 system-ui,
    sans-serif;
  cursor: pointer;
}
.umw button:hover {
  border-color: var(--umw-accent);
}
.umw button:focus-visible {
  outline: 2px solid var(--umw-accent);
  outline-offset: 4px;
}
.umw button:disabled {
  opacity: 0.4;
  cursor: default;
}
.umw-message {
  min-height: 36px;
  margin: 16px 0 0;
  color: #a4afc3;
  font-size: 12px;
}
.umw-presets {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #364258;
  font-size: 12px;
}
.umw-presets summary {
  cursor: pointer;
}
.umw-presets label {
  display: block;
  margin-top: 16px;
  color: #a4afc3;
}
.umw-presets textarea {
  display: block;
  width: 100%;
  min-width: 0;
  margin-top: 8px;
  padding: 10px;
  resize: vertical;
  border: 1px solid #46536a;
  border-radius: 6px;
  background: #0a1020;
  color: #e9f1fc;
  font: 11px/1.6 ui-monospace, monospace;
}
.umw-presets summary:focus-visible,
.umw-presets textarea:focus-visible {
  outline: 2px solid var(--umw-accent);
  outline-offset: 4px;
}
.umw-presets p {
  color: #a4afc3;
  font-size: 11px;
}
.umw-presets [data-error='true'] {
  color: #ffc3c6;
}
.umw-presets textarea[aria-invalid='true'] {
  border-color: #ffc3c6;
}
@media (max-width: 400px) {
  .umw {
    padding: 20px;
  }
}
`;
