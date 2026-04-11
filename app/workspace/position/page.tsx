import { redirect } from 'next/navigation';

/** Position absorbed into You/Scorecard. Redirect for backwards compat. */
export default function WorkspacePosition() {
  redirect('/you/scorecard');
}
