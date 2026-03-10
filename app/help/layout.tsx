import { SectionPillBar } from '@/components/civica/SectionPillBar';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="help" />
      {children}
    </>
  );
}
