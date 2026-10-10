/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Standalone Host
 * Purpose: Run the shared event-driven experience without a framework.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import { mountV02Workbench } from '@urk/examples/v02';

const host = document.querySelector<HTMLElement>('#app')!;
const workbench = mountV02Workbench(host);
window.addEventListener('pagehide', () => { void workbench.teardown(); }, { once: true });
if (import.meta.hot) import.meta.hot.dispose(() => { void workbench.teardown(); });
