/**
 * Company: EonHive Inc.
 * Title: URK Next Proof Layout
 * Purpose: Provide the App Router shell and metadata for the standalone Next proof.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'URK Next Proof',
  description: 'Minimal App Router proof for the thin next-urk client-boundary wrapper.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
