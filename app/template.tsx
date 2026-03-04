'use client';

import { lazy, Suspense } from 'react';

const PageTransition = lazy(() => import('@/components/PageTransition'));

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>{children}</div>}>
      <PageTransition>{children}</PageTransition>
    </Suspense>
  );
}
