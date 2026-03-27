import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CommitteePage() {
  redirect('/g?filter=cc');
}
