import { SectionPillBar } from '@/components/governada/SectionPillBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="governance" />
      <SectionSpotlightTrigger section="governance" />
      {children}
    </>
  );
}
