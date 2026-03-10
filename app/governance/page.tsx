export const dynamic = 'force-dynamic';

import { GovernanceRedirect } from './GovernanceRedirect';

/**
 * /governance — persona-aware redirect to the most relevant sub-page.
 *
 * | Persona               | Destination                   |
 * | --------------------- | ----------------------------- |
 * | Anonymous             | /governance/proposals          |
 * | Citizen (undelegated) | /governance/representatives    |
 * | Citizen (delegated)   | /governance/proposals          |
 * | DRep                  | /governance/proposals          |
 * | SPO                   | /governance/pools              |
 * | CC                    | /governance/proposals          |
 */
export default function GovernancePage() {
  return <GovernanceRedirect />;
}
