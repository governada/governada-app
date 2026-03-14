import { SectionPillBar } from '@/components/governada/SectionPillBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="help" />
      <SectionSpotlightTrigger section="help" />
      {children}
    </>
  );
}
