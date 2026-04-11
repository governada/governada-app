import { AppShellProviders } from '@/components/governada/AppShellProviders';
import { SectionTabBar } from '@/components/governada/SectionTabBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function YouLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProviders>
      <SectionTabBar section="you" />
      <SectionSpotlightTrigger section="you" />
      {children}
    </AppShellProviders>
  );
}
