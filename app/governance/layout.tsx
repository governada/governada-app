import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';
import { PeekDrawerProvider } from '@/components/governada/peeks/PeekDrawerProvider';

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabBar section="governance" />
      <SectionSpotlightTrigger section="governance" />
      <PeekDrawerProvider>{children}</PeekDrawerProvider>
    </>
  );
}
