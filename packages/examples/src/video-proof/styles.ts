/**
 * Company: EonHive Inc. | Title: Video Proof Styles
 * Purpose: Share a responsive, keyboard-accessible media deck across example hosts.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

export const videoProofStyles = `
.urk-video-proof {
  color: var(--urk-foreground, #e4edf9);
  background: var(--urk-background, #06101b);
  font: 14px/1.6 var(--urk-font-body, system-ui);
  padding: clamp(16px, 3vw, 32px);
  border: 1px solid var(--urk-border, #20384b);
  border-radius: 16px;
  max-width: 1240px;
  margin: auto;
}
.urk-video-proof * {
  box-sizing: border-box;
}
.urk-video-proof header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.urk-video-proof h2 {
  font: 600 clamp(28px, 4vw, 44px)/1.1 var(--urk-font-display, system-ui);
  letter-spacing: -1.5px;
  margin: 8px 0 16px;
}
.urk-video-proof h3 {
  font-size: 21px;
  letter-spacing: -0.6px;
  margin: 0;
}
.urk-video-proof p {
  color: var(--urk-muted, #9aafc5);
  margin: 8px 0 16px;
}
.urk-video-proof .video-kicker {
  color: var(--urk-cyan, #35dff2);
  font: 10px/1.5 var(--urk-font-code, monospace);
  letter-spacing: 1.6px;
}
.urk-video-proof .video-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  margin-bottom: 12px;
  border-block: 1px solid var(--urk-border, #20384b);
}
.urk-video-proof .video-runtime {
  margin-right: auto;
  font-size: 12px;
}
.urk-video-proof button,
.urk-video-proof select {
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--urk-border, #20384b);
  border-radius: 6px;
  color: inherit;
  background: var(--urk-surface, #0c1d2c);
  min-height: 40px;
  padding: 8px 12px;
  cursor: pointer;
}
.urk-video-proof button:hover:not(:disabled) {
  border-color: var(--urk-cyan, #35dff2);
}
.urk-video-proof button:disabled {
  opacity: 0.4;
  cursor: default;
}
.urk-video-proof button:focus-visible,
.urk-video-proof input:focus-visible,
.urk-video-proof select:focus-visible {
  outline: 2px solid var(--urk-cyan, #35dff2);
  outline-offset: 3px;
}
.urk-video-proof [data-play] {
  color: #06101b;
  background: linear-gradient(110deg, #35dff2, #b38bff);
  font-weight: 600;
  border-color: transparent;
}
.urk-video-proof .video-decks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.urk-video-proof .video-card {
  min-width: 0;
  border: 1px solid var(--urk-border, #20384b);
  background: var(--urk-surface, #0c1d2c);
  border-radius: 10px;
  overflow: hidden;
}
.urk-video-proof .video-card > header {
  padding: 12px 18px;
}
.urk-video-proof [data-status] {
  font-size: 11px;
  color: var(--urk-cyan, #35dff2);
}
.urk-video-proof video {
  display: block;
  width: 100%;
  aspect-ratio: 16/9;
  background: #06101b;
}
.urk-video-proof .video-card-body {
  padding: 20px;
}
.urk-video-proof [data-source] {
  font-size: 11px;
  overflow-wrap: anywhere;
}
.urk-video-proof fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.urk-video-proof .video-transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.urk-video-proof [data-time] {
  margin-left: auto;
  color: var(--urk-muted, #9aafc5);
  font: 11px var(--urk-font-code, monospace);
  white-space: nowrap;
}
.urk-video-proof label {
  color: var(--urk-muted, #9aafc5);
  font-size: 11px;
  display: grid;
  gap: 6px;
}
.urk-video-proof input {
  accent-color: var(--urk-cyan, #35dff2);
  min-width: 0;
  max-width: 100%;
}
.urk-video-proof input[type="range"] {
  width: 100%;
  min-height: 30px;
}
.urk-video-proof .video-seek {
  margin-top: 14px;
}
.urk-video-proof .video-settings {
  display: grid;
  grid-template-columns: minmax(65px, 1fr) auto auto;
  align-items: end;
  gap: 12px;
  margin-bottom: 16px;
}
.urk-video-proof .video-check {
  display: flex;
  align-items: center;
  min-height: 40px;
}
.urk-video-proof .video-files {
  border-top: 1px solid var(--urk-border, #20384b);
  padding-top: 16px;
  display: grid;
  gap: 12px;
}
.urk-video-proof input[type="file"] {
  font-size: 11px;
  width: 100%;
  min-height: 36px;
}
.urk-video-proof input::file-selector-button {
  color: inherit;
  background: transparent;
  border: 1px solid var(--urk-border, #20384b);
  padding: 7px;
  margin-right: 8px;
  border-radius: 4px;
}
.urk-video-proof .video-text-button {
  padding: 0;
  border: 0;
  color: var(--urk-cyan, #35dff2);
  background: transparent;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.urk-video-proof [data-message] {
  font-size: 11px;
  min-height: 36px;
  margin-bottom: 0;
}
.urk-video-proof .video-notes {
  margin: 20px 0 0;
  font-size: 12px;
}
.urk-video-proof .video-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 800px) {
  .urk-video-proof .video-decks {
    grid-template-columns: 1fr;
  }
  .urk-video-proof .video-runtime {
    flex-basis: 100%;
  }
}
`;
