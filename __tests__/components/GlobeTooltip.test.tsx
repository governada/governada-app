import { describe, expect, it } from 'vitest';
import { getDRepHoverFields } from '@/components/governada/GlobeTooltip';

describe('DRep hover legibility tiers', () => {
  it('maps camera proximity to progressive label fields', () => {
    expect(getDRepHoverFields('overview')).toEqual({
      showName: true,
      showScore: false,
      showIdentity: false,
      showDominantAlignment: false,
      showActions: false,
    });

    expect(getDRepHoverFields('cluster')).toEqual({
      showName: true,
      showScore: true,
      showIdentity: false,
      showDominantAlignment: false,
      showActions: false,
    });

    expect(getDRepHoverFields('tight')).toEqual({
      showName: true,
      showScore: true,
      showIdentity: true,
      showDominantAlignment: true,
      showActions: true,
    });
  });
});
