/**
 * Company: EonHive Inc.
 * Title: Next Ownership Navigation Target
 * Purpose: Unmount the integration runtime through App Router navigation.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import Link from 'next/link';

export default function AwayPage() {
  return <main><h1>Runtime unmounted</h1><Link href="/ownership">Return to runtime</Link></main>;
}
