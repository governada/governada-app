export const dynamic = 'force-dynamic';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';
import { AppShellProviders } from '@/components/governada/AppShellProviders';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProviders>
      <AdminAuthGate>
        <div className="flex min-h-[calc(100vh-4rem)]">
          <AdminSidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </AdminAuthGate>
    </AppShellProviders>
  );
}
