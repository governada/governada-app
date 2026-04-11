import { redirect } from 'next/navigation';
import { CIVIC_IDENTITY_PATH } from '@/lib/navigation/civicIdentity';

/** Identity moved to You. */
export default function IdentityPage() {
  redirect(CIVIC_IDENTITY_PATH);
}
