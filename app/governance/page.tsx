export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

/**
 * /governance — redirects to persona-default sub-page.
 * For now, defaults to /governance/proposals (the most universal entry point).
 * TODO: make persona-aware (citizens → representatives if undelegated).
 */
export default function GovernancePage() {
  redirect('/governance/proposals');
}
