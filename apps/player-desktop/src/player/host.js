/**
 * Company: EonHive Inc. | Title: Desktop Web Player Bootstrap
 * Purpose: Load the validated entrypoint through the unchanged optional Web Component.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import './urk-player.js';
document.querySelector('urk-player').src = new URL(location.href).searchParams.get('src') || '';
