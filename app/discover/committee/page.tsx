import { redirect } from 'next/navigation';

export default function DiscoverCommitteeRedirect() {
  redirect('/g?filter=cc');
}
