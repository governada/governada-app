import { redirect } from 'next/navigation';

/** DRep Scorecard consolidated into You/Scorecard. */
export default function DRepScorecardPage() {
  redirect('/you/scorecard');
}
