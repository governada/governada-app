import { AppShellProviders } from '@/components/governada/AppShellProviders';

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <AppShellProviders>{children}</AppShellProviders>;
}
