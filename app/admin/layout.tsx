export const dynamic = 'force-dynamic';

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGate>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AdminAuthGate>
  );
}
