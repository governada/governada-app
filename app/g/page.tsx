/**
 * /g — Globe home. Full constellation view with governance pulse data for SEO.
 */

import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function GlobeHomePage() {
  const supabase = createClient();

  const [{ count: drepCount }, { count: proposalCount }, { count: spoCount }] = await Promise.all([
    supabase.from('dreps').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
    supabase.from('proposals').select('*', { count: 'exact', head: true }),
    supabase.from('spo_governance_scores').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <article>
      <h1>Cardano Governance Constellation</h1>
      <p>
        Explore the governance ecosystem: {drepCount ?? 0} active DReps, {proposalCount ?? 0}{' '}
        proposals, and {spoCount ?? 0} stake pool operators participating in on-chain governance.
      </p>
      <nav aria-label="Governance entities">
        <ul>
          <li>
            <a href="/g?filter=dreps">Browse DReps</a>
          </li>
          <li>
            <a href="/g?filter=proposals">Browse Proposals</a>
          </li>
          <li>
            <a href="/g?filter=spos">Browse Stake Pools</a>
          </li>
          <li>
            <a href="/g?filter=cc">Constitutional Committee</a>
          </li>
        </ul>
      </nav>
    </article>
  );
}
