'use client';

import { usePathname } from 'next/navigation';
import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudioMode =
    pathname === '/workspace/review' ||
    /^\/workspace\/(author|editor|amendment)\/[^/]+/.test(pathname);

  return (
    <>
      {!isStudioMode && <SectionTabBar section="home" />}
      {!isStudioMode && <SectionSpotlightTrigger section="workspace" />}
      {children}
    </>
  );
}
