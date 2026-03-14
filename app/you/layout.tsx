import { SectionPillBar } from '@/components/governada/SectionPillBar';
import { SectionSpotlightTrigger } from '@/components/discovery/SectionSpotlightTrigger';

export default function YouLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="you" />
      <SectionSpotlightTrigger section="you" />
      {children}
    </>
  );
}
