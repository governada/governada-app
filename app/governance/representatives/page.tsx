import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RepresentativesPage() {
  redirect('/g?filter=dreps');
}
