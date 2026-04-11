import { AppShellProviders } from '@/components/governada/AppShellProviders';

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <AppShellProviders>{children}</AppShellProviders>;
}
