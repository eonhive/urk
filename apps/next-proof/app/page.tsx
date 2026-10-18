/**
 * Company: EonHive Inc.
 * Title: URK Next Proof Page
 * Purpose: Render the single App Router proof surface for validating @urk/next.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

import Link from 'next/link';
import { NextProofClient } from './next-proof-client';

export default function Page() {
  return <><Link href="/v02">Try URK v0.2</Link><NextProofClient /></>;
}
