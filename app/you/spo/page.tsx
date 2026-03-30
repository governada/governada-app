import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Pool Scorecard consolidated into You/Scorecard. Preserve role context for dual-role users. */
export default function SPOScorecardPage() {
  redirect('/you/scorecard?role=spo');
}
