import { SectionPillBar } from '@/components/governada/SectionPillBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="home" />
      <SectionSpotlightTrigger section="workspace" />
      {children}
    </>
  );
}
