import { redirect } from 'next/navigation';

export default function CommitteeLegacyRedirect() {
  redirect('/g?filter=cc');
}
