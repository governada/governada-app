import { AppShellProviders } from '@/components/governada/AppShellProviders';

export default function MyGovLayout({ children }: { children: React.ReactNode }) {
  return <AppShellProviders>{children}</AppShellProviders>;
}
