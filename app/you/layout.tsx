import { SectionPillBar } from '@/components/civica/SectionPillBar';

export default function YouLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="you" />
      {children}
    </>
  );
}
