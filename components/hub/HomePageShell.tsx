import { PageViewTracker } from '@/components/PageViewTracker';
import { GlobeLayout } from '@/components/globe/GlobeLayout';
import { HomepageMatchWorkspace } from '@/components/hub/HomepageMatchWorkspace';
import { headers } from 'next/headers';
import Script from 'next/script';
import { isHomepageMatchMode } from '@/lib/matching/routes';

interface HomePageShellProps {
  filter?: string;
  entity?: string;
  mode?: string;
  sort?: string;
}

const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Governada',
  url: 'https://governada.io',
  description:
    'Governance intelligence for Cardano. Build your governance team, track proposals, and participate in on-chain democracy.',
  applicationCategory: 'GovernanceApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Governada',
    url: 'https://governada.io',
  },
};

export async function HomePageShell({ filter, entity, mode, sort }: HomePageShellProps) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const isMatchWorkspace = isHomepageMatchMode(mode);

  return (
    <>
      <Script
        id="json-ld-organization"
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSON_LD) }}
      />
      <PageViewTracker event="homepage_viewed" />
      {isMatchWorkspace ? (
        <HomepageMatchWorkspace />
      ) : (
        <GlobeLayout initialFilter={filter} initialEntity={entity} initialSort={sort} />
      )}
    </>
  );
}
