import { redirect } from 'next/navigation';

/**
 * /you/identity is deprecated — identity now lives at /you.
 * This redirect ensures old bookmarks still work.
 */
export default function IdentityRedirect() {
  redirect('/you');
}
