import { PageViewTracker } from '@/components/PageViewTracker';
import { HubHomePage } from '@/components/hub/HubHomePage';
import {
  StructuredDataMeta,
  StructuredDataNested,
  StructuredDataRoot,
} from '@/components/shared/StructuredDataMicrodata';

interface HomePageShellProps {
  filter?: string;
  entity?: string;
  match?: boolean;
  sort?: string;
  pageViewEvent?: string;
}

export function HomePageShell({
  filter,
  entity,
  match,
  sort,
  pageViewEvent = 'homepage_viewed',
}: HomePageShellProps) {
  return (
    <StructuredDataRoot itemType="https://schema.org/WebApplication">
      <StructuredDataMeta itemProp="name" content="Governada" />
      <StructuredDataMeta itemProp="url" content="https://governada.io" />
      <StructuredDataMeta
        itemProp="description"
        content="Governance intelligence for Cardano. Build your governance team, track proposals, and participate in on-chain democracy."
      />
      <StructuredDataMeta itemProp="applicationCategory" content="GovernanceApplication" />
      <StructuredDataMeta itemProp="operatingSystem" content="Web" />
      <StructuredDataNested itemProp="offers" itemType="https://schema.org/Offer">
        <StructuredDataMeta itemProp="price" content="0" />
        <StructuredDataMeta itemProp="priceCurrency" content="USD" />
      </StructuredDataNested>
      <StructuredDataNested itemProp="publisher" itemType="https://schema.org/Organization">
        <StructuredDataMeta itemProp="name" content="Governada" />
        <StructuredDataMeta itemProp="url" content="https://governada.io" />
      </StructuredDataNested>
      <PageViewTracker event={pageViewEvent} />
      <HubHomePage filter={filter} entity={entity} match={match} sort={sort} />
    </StructuredDataRoot>
  );
}
