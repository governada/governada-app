import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * /delegation is deprecated — its content has been folded into the CitizenHub homepage.
 * Redirect any direct visits to the home page.
 */
export default function Delegation() {
  redirect('/you/delegation');
}
