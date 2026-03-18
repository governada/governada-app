'use client';

import { usePathname } from 'next/navigation';
import { SectionPillBar } from '@/components/governada/SectionPillBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudioMode =
    pathname === '/workspace/review' || /^\/workspace\/(author|editor)\/[^/]+/.test(pathname);

  return (
    <>
      {!isStudioMode && <SectionPillBar section="home" />}
      {!isStudioMode && <SectionSpotlightTrigger section="workspace" />}
      {children}
    </>
  );
}
