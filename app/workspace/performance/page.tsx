import { redirect } from 'next/navigation';

/** Performance absorbed into You/Scorecard. Redirect for backwards compat. */
export default function WorkspacePerformance() {
  redirect('/you/scorecard');
}
