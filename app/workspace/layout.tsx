'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Studio mode = deep-dive into a specific item (tab bar hidden to maximize workspace)
  // Review portfolio (/workspace/review without ?proposal=) is NOT studio mode
  const isReviewStudio = pathname === '/workspace/review' && searchParams.has('proposal');
  const isAuthorStudio = /^\/workspace\/(author|editor|amendment)\/[^/]+/.test(pathname);
  const isStudioMode = isReviewStudio || isAuthorStudio;

  return (
    <>
      {!isStudioMode && <SectionTabBar section="workspace" />}
      {!isStudioMode && <SectionSpotlightTrigger section="workspace" />}
      {children}
    </>
  );
}
