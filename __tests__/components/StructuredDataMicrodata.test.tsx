import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  StructuredDataMeta,
  StructuredDataNested,
  StructuredDataRoot,
} from '@/components/shared/StructuredDataMicrodata';

describe('StructuredDataMicrodata', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders visible-root microdata with nested schema objects', () => {
    render(
      <StructuredDataRoot itemType="https://schema.org/Article">
        <StructuredDataMeta itemProp="headline" content="Governance Proposal" />
        <StructuredDataNested itemProp="publisher" itemType="https://schema.org/Organization">
          <StructuredDataMeta itemProp="name" content="Governada" />
        </StructuredDataNested>
      </StructuredDataRoot>,
    );

    const root = document.querySelector('[itemtype="https://schema.org/Article"]');
    const nested = document.querySelector('[itemtype="https://schema.org/Organization"]');
    const headline = document.querySelector('meta[itemprop="headline"]');
    const publisherName = nested?.querySelector('meta[itemprop="name"]');

    expect(root).not.toBeNull();
    expect(headline?.getAttribute('content')).toBe('Governance Proposal');
    expect(nested?.getAttribute('itemprop')).toBe('publisher');
    expect(publisherName?.getAttribute('content')).toBe('Governada');
  });

  it('omits empty meta content', () => {
    render(
      <StructuredDataRoot itemType="https://schema.org/Thing">
        <StructuredDataMeta itemProp="name" content="" />
      </StructuredDataRoot>,
    );

    expect(document.querySelector('meta[itemprop="name"]')).toBeNull();
  });
});
