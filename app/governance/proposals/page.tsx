import { redirect } from 'next/navigation';

export default function ProposalsPage() {
  redirect('/?filter=proposals');
}
