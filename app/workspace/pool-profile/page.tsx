import { redirect } from 'next/navigation';

/** Pool profile management moved to You/Settings. Redirect for backwards compat. */
export default function WorkspacePoolProfile() {
  redirect('/you/settings');
}
