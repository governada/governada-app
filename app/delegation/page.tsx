import { redirect } from 'next/navigation';

/**
 * /delegation is deprecated — its content has been folded into the home experience.
 * Redirect any direct visits to the home page.
 */
export default function Delegation() {
  redirect('/you/delegation');
}
