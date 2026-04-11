import { redirect } from 'next/navigation';

/** Delegators absorbed into You/Scorecard. Redirect for backwards compat. */
export default function WorkspaceDelegators() {
  redirect('/you/scorecard');
}
