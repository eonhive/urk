/**
 * Company: EonHive Inc. | Title: Audio Widget Styles
 * Purpose: Keep portable audio controls and Canvas surfaces scoped to their widget.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
export const audioWidgetStyles = `
.uaw { color-scheme:dark; color:#e7edf9; background:#111a2d; border:1px solid #394762; border-radius:16px; padding:clamp(16px,3vw,28px); font:15px/1.5 system-ui,sans-serif; min-width:0; }
.uaw * { box-sizing:border-box; }
.uaw h2 { font-size:28px; line-height:1.2; margin:0 0 10px; color:inherit; }
.uaw p { margin:12px 0; }
.uaw .uaw-controls,.uaw .uaw-settings { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:16px 0; }
.uaw button,.uaw select { font:inherit; color:inherit; padding:8px 12px; background:#18233b; border:1px solid #52617c; border-radius:7px; }
.uaw button { cursor:pointer; }
.uaw button:disabled,.uaw input:disabled,.uaw select:disabled { opacity:.45; cursor:default; }
.uaw :focus-visible { outline:3px solid #b0a8ff; outline-offset:3px; }
.uaw label { display:flex; align-items:center; gap:7px; font-size:13px; }
.uaw input { accent-color:#7be3cd; }
.uaw input[type=range] { width:100px; max-width:100%; }
.uaw .uaw-plots { display:block; width:100%; height:auto; border:1px solid #394762; border-radius:12px; background:#0b1020; }
.uaw .uaw-pulse { display:block; width:220px; max-width:100%; height:auto; margin:12px auto; }
.uaw .uaw-meters { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
.uaw .uaw-meters label { display:grid; grid-template-columns:1fr auto; }
.uaw meter { width:100%; height:14px; grid-column:1/-1; }
.uaw output { color:#7be3cd; font-variant-numeric:tabular-nums; }
.uaw .uaw-note { color:#afbed5; font-size:12px; }
.uaw [role=status] { min-height:1.5em; }
@media(max-width:480px) { .uaw .uaw-meters { grid-template-columns:repeat(2,minmax(0,1fr)); } }
`;
