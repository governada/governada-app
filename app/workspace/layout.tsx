import { SectionPillBar } from '@/components/civica/SectionPillBar';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionPillBar section="workspace" />
      {children}
    </>
  );
}
