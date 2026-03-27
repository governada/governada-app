import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ProposalsPage() {
  redirect('/g?filter=proposals');
}
