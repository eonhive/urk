/**
 * Company: EonHive Inc. | Title: Shared Audio Lab Styles
 * Purpose: Scope the same responsive audio controls and visual surfaces to either host.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
export const audioLabStyles = `
.urk-audio-lab { color-scheme: dark; font: 15px/1.5 system-ui,sans-serif; color:#e7edf9; background:#0b1020; padding:clamp(20px,4vw,36px); border:1px solid #24344f; border-radius:18px; min-width:0; }
.urk-audio-lab * { box-sizing:border-box; }
.urk-audio-lab [hidden] { display:none!important; }
.urk-audio-lab h2 { font-size:clamp(30px,4vw,48px); letter-spacing:-.04em; margin:10px 0; line-height:1.1; color:inherit; }
.urk-audio-lab p { color:#a9b9d1; margin:12px 0; }
.urk-audio-lab .audio-kicker { color:#7be3cd; letter-spacing:.14em; font-size:11px; }
.urk-audio-lab .audio-row { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin:20px 0; }
.urk-audio-lab label { display:flex; align-items:center; gap:7px; font-size:13px; }
.urk-audio-lab button,.urk-audio-lab select { font:inherit; color:inherit; border:1px solid #394762; background:#18233b; border-radius:7px; padding:8px 12px; }
.urk-audio-lab button { cursor:pointer; }
.urk-audio-lab [data-audio=play] { color:#0b1020; background:#7be3cd; border-color:transparent; font-weight:650; }
.urk-audio-lab button:disabled { opacity:.45; cursor:default; }
.urk-audio-lab :focus-visible { outline:3px solid #b0a8ff; outline-offset:3px; }
.urk-audio-lab input { accent-color:#7be3cd; }
.urk-audio-lab input[type=range] { width:100px; }
.urk-audio-lab .audio-visuals { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(260px,1fr); gap:16px; }
.urk-audio-lab .audio-plots,.urk-audio-lab .audio-scene-wrap { background:#111a2d; border:1px solid #24344f; border-radius:12px; overflow:hidden; }
.urk-audio-lab .audio-plots { width:100%; height:100%; object-fit:contain; display:block; min-height:240px; }
.urk-audio-lab .audio-scene-wrap { position:relative; min-height:300px; }
.urk-audio-lab [data-audio=scene] { position:absolute; inset:0; }
.urk-audio-lab [data-audio=scene-status] { position:absolute; bottom:12px; left:16px; right:16px; margin:0; font-size:12px; pointer-events:none; }
.urk-audio-lab .audio-meters { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px; margin:24px 0; }
.urk-audio-lab .audio-meters label { display:grid; grid-template-columns:1fr auto; }
.urk-audio-lab meter { width:100%; height:14px; grid-column:1/-1; }
.urk-audio-lab output { color:#7be3cd; font-variant-numeric:tabular-nums; }
.urk-audio-lab [data-audio=status] { min-height:1.5em; color:#e7edf9; }
.urk-audio-lab .audio-foot { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; color:#94a9c9; font-size:12px; }
.urk-audio-lab .audio-note { font-size:12px; }
@media(max-width:760px) { .urk-audio-lab .audio-visuals { grid-template-columns:1fr; } .urk-audio-lab .audio-scene-wrap { min-height:280px; } }
@media(max-width:440px) { .urk-audio-lab .audio-meters { grid-template-columns:repeat(2,minmax(0,1fr)); } }
`;
