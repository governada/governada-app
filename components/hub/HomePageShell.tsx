import { headers } from 'next/headers';
import Script from 'next/script';
import { PageViewTracker } from '@/components/PageViewTracker';
import { HubHomePage } from '@/components/hub/HubHomePage';

interface HomePageShellProps {
  filter?: string;
  entity?: string;
  match?: boolean;
  sort?: string;
  pageViewEvent?: string;
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

export async function HomePageShell({
  filter,
  entity,
  match,
  sort,
  pageViewEvent = 'homepage_viewed',
}: HomePageShellProps) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <Script
        id="json-ld-organization"
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSON_LD) }}
      />
      <PageViewTracker event={pageViewEvent} />
      <HubHomePage filter={filter} entity={entity} match={match} sort={sort} />
    </>
  );
}
