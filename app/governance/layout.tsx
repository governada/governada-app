import { SectionPillBar } from '@/components/civica/SectionPillBar';

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="governance" />
      {children}
    </>
  );
}
