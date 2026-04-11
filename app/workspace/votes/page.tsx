import { redirect } from 'next/navigation';

/** Voting record moved to You/Record. Redirect for backwards compat. */
export default function WorkspaceVotes() {
  redirect('/you/record');
}
