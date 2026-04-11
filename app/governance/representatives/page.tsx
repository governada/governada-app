import { redirect } from 'next/navigation';

export default function RepresentativesPage() {
  redirect('/?filter=dreps');
}
