import { AppShellProviders } from '@/components/governada/AppShellProviders';

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <AppShellProviders>{children}</AppShellProviders>;
}
