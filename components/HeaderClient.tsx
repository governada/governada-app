'use client';

/**
 * Client wrapper for Header with dynamic import to prevent MeshJS/libsodium SSR issues
 */

import dynamic from 'next/dynamic';

const Header = dynamic(
  () => import('@/components/Header').then((mod) => ({ default: mod.Header })),
  { ssr: false },
);

export function HeaderClient() {
  return <Header />;
}
