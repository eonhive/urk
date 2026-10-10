/**
 * Company: EonHive Inc.
 * Title: URK v0.2 React Entry
 * Purpose: Run the shared experience with provider-owned cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { V02Host } from './host';

const root = createRoot(document.getElementById('app')!);
root.render(<StrictMode><V02Host /></StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
