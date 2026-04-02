import { redirect } from 'next/navigation';

export default function CommitteeLegacyRedirect() {
  redirect('/governance/committee');
}
