'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, ThumbsUp, Plus } from 'lucide-react';
import { useDraftReviews } from '@/hooks/useDraftReviews';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DeduplicationBannerProps {
  draftId: string;
  onEndorse: (themes: string[]) => void;
  onAddNew: () => void;
}

export function DeduplicationBanner({ draftId, onEndorse, onAddNew }: DeduplicationBannerProps) {
  const { data } = useDraftReviews(draftId);

  const themeFrequencies = useMemo(() => {
    if (!data || data.reviews.length === 0) return [];

    const counts = new Map<string, number>();
    for (const review of data.reviews) {
      for (const theme of review.feedbackThemes) {
        counts.set(theme, (counts.get(theme) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([theme, count]) => ({ theme, count }));
  }, [data]);

  // Don't show banner if no existing themes
  if (themeFrequencies.length === 0) return null;

  const allThemes = themeFrequencies.map((t) => t.theme);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Existing feedback themes</p>
            <div className="flex flex-wrap gap-1.5">
              {themeFrequencies.map(({ theme, count }) => (
                <Badge key={theme} variant="secondary" className="text-xs">
                  {theme}{' '}
                  <span className="ml-1 text-muted-foreground">
                    ({count} reviewer{count !== 1 ? 's' : ''})
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-6">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onEndorse(allThemes)}
          >
            <ThumbsUp className="mr-1.5 h-3 w-3" />
            Endorse existing themes
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={onAddNew}>
            <Plus className="mr-1.5 h-3 w-3" />
            Add something new
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
