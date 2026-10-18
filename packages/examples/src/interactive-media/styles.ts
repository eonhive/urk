/**
 * Company: EonHive Inc. | Title: Interactive Media Styles
 * Purpose: Share the responsive Orbit presentation across standalone and website hosts.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */

export const mediaStyles = `
.urk-interactive-media {
  --media-accent: #55e3eb;
  color: var(--urk-foreground, #e4edf9);
  background: var(--urk-background, #06101b);
  border: 1px solid var(--urk-border, #24394a);
  border-radius: 16px;
  padding: clamp(16px, 3vw, 32px);
  max-width: 1280px;
  margin: auto;
  font: 14px/1.6 var(--urk-font-body, system-ui);
}
.urk-interactive-media * {
  box-sizing: border-box;
}
.urk-interactive-media [hidden] {
  display: none;
}
.urk-interactive-media h2 {
  font: 600 clamp(32px, 5vw, 56px)/1.05 var(--urk-font-display, system-ui);
  letter-spacing: -2px;
  margin: 10px 0 14px;
}
.urk-interactive-media h3 {
  font-size: 24px;
  line-height: 1.2;
  letter-spacing: -0.6px;
  margin: 12px 0;
}
.urk-interactive-media p {
  color: var(--urk-muted, #9aafc5);
  margin: 8px 0 20px;
}
.urk-interactive-media .media-kicker {
  font: 10px/1.5 var(--urk-font-code, monospace);
  letter-spacing: 1.8px;
  color: var(--urk-cyan, #55e3eb);
}
.urk-interactive-media .media-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  border-block: 1px solid var(--urk-border, #24394a);
  padding: 14px 0;
  margin: 24px 0;
}
.urk-interactive-media .media-runtime {
  margin-right: auto;
  font: 11px var(--urk-font-code, monospace);
}
.urk-interactive-media button {
  font: inherit;
  font-size: 12px;
  min-height: 42px;
  padding: 8px 14px;
  color: inherit;
  background: var(--urk-surface, #0c1d2c);
  border: 1px solid var(--urk-border, #24394a);
  border-radius: 6px;
  cursor: pointer;
}
.urk-interactive-media button:hover:not(:disabled) {
  border-color: var(--urk-cyan, #55e3eb);
}
.urk-interactive-media button:disabled {
  opacity: 0.4;
  cursor: default;
}
.urk-interactive-media button:focus-visible,
.urk-interactive-media input:focus-visible {
  outline: 2px solid var(--urk-cyan, #55e3eb);
  outline-offset: 3px;
}
.urk-interactive-media .media-primary {
  color: #06101b;
  background: linear-gradient(110deg, #55e3eb, #b596ff);
  border: 0;
  font-weight: 650;
}
.urk-interactive-media .media-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(260px, 1fr);
  gap: 28px;
}
.urk-interactive-media .media-main {
  min-width: 0;
}
.urk-interactive-media .media-screen {
  position: relative;
  width: 100%;
  aspect-ratio: 16/10;
  border-radius: 10px;
  overflow: hidden;
  background: #06101b;
  border: 1px solid #24394a;
}
.urk-interactive-media [data-film] { height: 100%; }
.urk-interactive-media .media-ending {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(18px, 4vw, 40px);
  background: radial-gradient(ellipse at top right, #213245, transparent 70%), #081421;
  color: #e4edf9;
}
.urk-interactive-media .media-ending h3 { font-size: clamp(24px, 3vw, 42px); max-width: 480px; }
.urk-interactive-media .media-ending p { color: #9aafc5; max-width: 430px; font-size: 12px; }
.urk-interactive-media .media-ending fieldset { display: flex; flex-wrap: wrap; gap: 10px; }
.urk-interactive-media .media-ending[hidden] { display: none; }
.urk-interactive-media .media-orbit-mark {
  width: 68px;
  height: 68px;
  border: 1px solid #39516a;
  border-radius: 50%;
  margin-bottom: 20px;
  display: grid;
  place-items: center;
}
.urk-interactive-media .media-orbit-mark span {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #55e3eb, #b596ff);
  box-shadow: 22px -17px 0 -10px #55e3eb;
}
.urk-interactive-media video {
  display: block;
  width: 100%;
  aspect-ratio: 16/10;
  object-fit: cover;
}
.urk-interactive-media .media-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  padding: clamp(18px, 3vw, 32px);
  background: linear-gradient(180deg, rgba(2, 10, 18, 0.55), transparent 70%);
  color: #e4edf9;
}
.urk-interactive-media .media-overlay span {
  font: 10px monospace;
  letter-spacing: 1.8px;
  color: var(--media-accent);
}
.urk-interactive-media .media-overlay h3 {
  font: 600 clamp(24px, 3vw, 40px)/1.05 var(--urk-font-display, system-ui);
  white-space: pre-line;
  max-width: 85%;
  margin: 18px 0 12px;
}
.urk-interactive-media .media-overlay p {
  color: #b3c6d9;
  font-size: 12px;
  max-width: 220px;
}
.urk-interactive-media .media-hotspot {
  position: absolute;
  right: 20px;
  bottom: 26%;
  color: #e4edf9;
  background: #123449;
  border-color: #55e3eb;
}
.urk-interactive-media fieldset {
  padding: 0;
  margin: 0;
  min-width: 0;
  border: 0;
}
.urk-interactive-media .media-controls {
  padding: 16px 0 0;
}
.urk-interactive-media .media-recovery {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--urk-border, #39516a);
  border-left: 3px solid var(--urk-cyan, #55e3eb);
  border-radius: 8px;
  background: var(--urk-surface, #0c1d2c);
}
.urk-interactive-media .media-recovery p { margin: 4px 0 0; font-size: 12px; max-width: 42ch; }
.urk-interactive-media .media-recovery[hidden] { display: none; }
.urk-interactive-media .media-transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.urk-interactive-media [data-time] {
  margin-left: auto;
  font: 11px monospace;
  color: var(--urk-muted, #9aafc5);
}
.urk-interactive-media label {
  font-size: 12px;
  color: var(--urk-muted, #9aafc5);
}
.urk-interactive-media input {
  accent-color: var(--urk-cyan, #55e3eb);
}
.urk-interactive-media .media-seek {
  display: grid;
  margin-top: 16px;
}
.urk-interactive-media input[type="range"] {
  width: 100%;
  margin: 0;
  min-height: 36px;
}
.urk-interactive-media .media-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
}
.urk-interactive-media .media-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}
.urk-interactive-media .media-footnote {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px solid var(--urk-border, #24394a);
  padding: 18px 0 0;
  margin-top: 16px;
  font-size: 10px;
  color: var(--urk-muted, #9aafc5);
}
.urk-interactive-media .media-journey > p {
  font-size: 12px;
}
.urk-interactive-media .media-chapters {
  display: grid;
  gap: 6px;
  margin-bottom: 22px;
}
.urk-interactive-media .media-chapters button {
  display: flex;
  text-align: left;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: transparent;
  border-color: transparent;
}
.urk-interactive-media .media-chapters button[aria-current="step"] {
  border-color: var(--urk-border, #24394a);
  background: var(--urk-surface, #0c1d2c);
}
.urk-interactive-media .media-chapters span {
  color: var(--urk-cyan, #55e3eb);
  font: 11px monospace;
}
.urk-interactive-media strong {
  display: block;
  font-weight: 550;
}
.urk-interactive-media small {
  display: block;
  font-weight: 400;
  font-size: 11px;
  color: var(--urk-muted, #9aafc5);
  margin-top: 3px;
}
.urk-interactive-media .media-choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.urk-interactive-media .media-choices > span {
  grid-column: 1/-1;
  margin-bottom: 4px;
}
.urk-interactive-media .media-choices button {
  text-align: left;
  padding: 12px;
}
.urk-interactive-media .media-choices button[aria-pressed="true"] {
  border-color: var(--urk-cyan, #55e3eb);
}
.urk-interactive-media [data-outcome] {
  font-size: 12px;
  min-height: 44px;
  margin: 18px 0;
}
.urk-interactive-media .media-cue {
  display: grid;
  gap: 6px;
  border-top: 1px solid var(--urk-border, #24394a);
  padding-top: 14px;
  font: 10px/1.6 monospace;
  color: var(--urk-muted, #9aafc5);
}
.urk-interactive-media .media-cue output {
  color: var(--urk-cyan, #55e3eb);
}
.urk-interactive-media [data-result] {
  margin-bottom: 0;
  font-size: 12px;
}
.urk-interactive-media .media-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.urk-interactive-media .media-gallery, .urk-interactive-media .media-ending {
  --urk-surface: #0c1d2c;
  --urk-border: #24394a;
  --urk-cyan: #55e3eb;
  --urk-muted: #9aafc5;
}
.urk-interactive-media .media-gallery { position: absolute; inset: 0; background: #06101b; color: #e4edf9; }
.urk-interactive-media [data-gallery-surface] { position: absolute; inset: 66px 0 118px; cursor: pointer; }
.urk-interactive-media [data-gallery-surface]:focus-visible { outline: 2px solid #55e3eb; outline-offset: -3px; }
.urk-interactive-media .media-gallery-heading { position: absolute; top: 18px; left: 20px; pointer-events: none; }
.urk-interactive-media .media-gallery-heading h3 { font-size: clamp(18px, 2vw, 25px); margin: 4px 0; }
.urk-interactive-media .media-gallery-footer { position: absolute; bottom: 16px; left: 16px; right: 16px; }
.urk-interactive-media .media-gallery-footer p { font-size: 10px; color: #9aafc5; margin: 0 0 8px; }
.urk-interactive-media .media-gallery-footer fieldset { display: flex; flex-wrap: wrap; gap: 6px; }
.urk-interactive-media .media-gallery-footer button { font-size: 11px; padding: 6px 10px; }
.urk-interactive-media [data-gallery-branch][aria-pressed="true"] { border-color: #55e3eb; background: #173245; }
.urk-interactive-media .media-gallery-caption { position: absolute; bottom: 124px; left: 10%; right: 10%; text-align: center; background: #000c; color: white; padding: 5px 10px; font-size: 13px; pointer-events: none; }
.urk-interactive-media .media-sound {
  border-top: 1px solid var(--urk-border, #24394a);
  padding-top: 18px;
  margin-top: 24px;
}
.urk-interactive-media .media-sound legend {
  padding-right: 12px;
  color: var(--urk-muted, #9aafc5);
  font: 10px monospace;
  letter-spacing: 1.5px;
}
.urk-interactive-media .media-levels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 16px;
}
.urk-interactive-media .media-sound p { font-size: 12px; margin: 6px 0; }
.urk-interactive-media .media-reaction { display: flex; align-items: center; gap: 14px; margin-top: 16px; }
.urk-interactive-media .media-reaction meter { width: 100%; max-width: 160px; min-width: 60px; height: 14px; accent-color: var(--media-accent); }
.urk-interactive-media [data-react][aria-pressed="true"] { border-color: var(--media-accent); }
@media (max-width: 850px) {
  .urk-interactive-media .media-layout {
    grid-template-columns: 1fr;
  }
  .urk-interactive-media .media-runtime {
    flex-basis: 100%;
    margin-bottom: 6px;
  }
}
@media (max-width: 600px) {
  .urk-interactive-media .media-screen { min-height: 360px; }
  .urk-interactive-media video { height: 100%; }
  .urk-interactive-media .media-orbit-mark { width: 40px; height: 40px; margin-bottom: 10px; }
  .urk-interactive-media .media-orbit-mark span { width: 20px; height: 20px; }
  .urk-interactive-media .media-ending h3 { margin: 8px 0; }
  .urk-interactive-media .media-ending p { margin: 4px 0 14px; }
}
@media (max-width: 430px) {
  .urk-interactive-media .media-overlay {
    padding: 16px;
  }
  .urk-interactive-media .media-overlay h3 {
    font-size: 25px;
    margin: 12px 0 8px;
  }
  .urk-interactive-media .media-overlay p {
    max-width: 180px;
    font-size: 11px;
  }
  .urk-interactive-media .media-hotspot {
    bottom: 14%;
    right: 12px;
    min-height: 38px;
  }
}
`;
