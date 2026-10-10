/**
 * Company: EonHive Inc.
 * Title: Playground Styles
 * Purpose: Share responsive playground presentation across every host.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

export const styles = `
.urk-v02 {color:#e8edf7;background:#0c1322;border:1px solid #29354d;border-radius:24px;padding:28px;font:15px/1.5 system-ui;max-width:1000px;margin:24px auto;box-sizing:border-box}
.urk-v02 * {box-sizing:border-box}
.urk-v02 h1 {font-size:clamp(28px,5vw,44px);line-height:1.1;margin:8px 0 12px;letter-spacing:-1.5px}
.urk-v02 p {color:#a8b5cd;margin:8px 0 20px;max-width:70ch}
.urk-v02 .eyebrow {color:#5eead4;font-size:11px;letter-spacing:2px;font-weight:700}
.urk-v02 .toolbar {display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
.urk-v02 button {font:inherit;border:1px solid #3d4d68;border-radius:10px;background:#182438;color:#e8edf7;padding:8px 12px;cursor:pointer}
.urk-v02 button:hover:not(:disabled) {border-color:#5eead4;background:#223c48}
.urk-v02 button:focus-visible,.urk-v02 input:focus-visible,.urk-v02 .viewport:focus-visible {outline:2px solid #5eead4;outline-offset:4px}
.urk-v02 button:disabled,.urk-v02 input:disabled {opacity:.45;cursor:default}
.urk-v02 .metrics {display:flex;gap:24px;flex-wrap:wrap;border-top:1px solid #263248;border-bottom:1px solid #263248;padding:12px 0}
.urk-v02 .metrics span {color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.urk-v02 output {display:block;color:#5eead4;font-weight:600}
.urk-v02 .surface {position:relative;margin-top:20px}
.urk-v02 .scene-shell {position:relative;border:1px solid #34445e;border-radius:18px;overflow:hidden;background:radial-gradient(ellipse at 20% 40%,#16444870,transparent 45%),radial-gradient(ellipse at 80% 55%,#46336670,transparent 45%),linear-gradient(160deg,#19273d,#0c1526)}
.urk-v02 .scene-shell::after {content:'';position:absolute;inset:75% 0 0;pointer-events:none;background:linear-gradient(transparent,#0a122280)}
.urk-v02 .viewport {height:340px;touch-action:pan-y}
.urk-v02 .scene-overlay {position:absolute;inset:0;pointer-events:none}
.urk-v02 .scene-caption {display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#adbad0;font-size:12px;margin:12px 2px}
.urk-v02 kbd {border:1px solid #3d4d68;padding:1px 5px;border-radius:4px;color:#e0eaf8;font:inherit}
.urk-v02 .cards {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}
.urk-v02 .cards button {min-height:90px;text-align:left;padding:14px 16px;background:#131f32}
.urk-v02 .cards strong {display:block;font-size:18px;color:#f8fafc}
.urk-v02 .cards small {color:#a8b5cd;font-size:12px}
.urk-v02 .cards button[aria-pressed=true] {border-color:#5eead4;background:#163633}
.urk-v02 .interaction-bar {display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid #263248;padding-top:16px}
.urk-v02 .volume {display:flex;align-items:center;gap:8px;color:#b5c2d7;font-size:13px}
.urk-v02 input[type=range] {width:100px;accent-color:#5eead4}
.urk-v02 .local-status {color:#97acc4;font-size:12px;flex-basis:100%;font-weight:400;min-height:18px}
.urk-v02 .storage-label {margin-left:auto;font-size:12px;color:#a8b5cd}
.urk-v02 pre {white-space:pre-wrap;color:#9fdbc9;font-size:12px;margin:12px 0 0}
.urk-v02 [data-testid=v02-message]:empty {display:none}
.urk-v02 .surface[data-paused=true] .viewport {opacity:.55;cursor:default}
@media(max-width:600px){.urk-v02{padding:18px;margin:12px;border-radius:18px}.urk-v02 .viewport{height:260px}.urk-v02 .cards button{padding:10px;min-height:84px}.urk-v02 .cards strong{font-size:15px}.urk-v02 .cards small{font-size:11px}.urk-v02 .metrics{gap:14px}.urk-v02 .toolbar button{font-size:12px}.urk-v02 .storage-label{margin-left:0}}
`;
