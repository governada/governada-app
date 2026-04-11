export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function AdminSystemsIndexPage() {
  redirect('/admin/systems/launch');
}
