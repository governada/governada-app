'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Star, Send, X } from 'lucide-react';
import { useSubmitReview } from '@/hooks/useDraftReviews';

// ---------------------------------------------------------------------------
// Score dimensions
// ---------------------------------------------------------------------------

const DIMENSIONS = [
  {
    key: 'impact' as const,
    label: 'Impact',
    description: 'How significant is the potential impact?',
  },
  {
    key: 'feasibility' as const,
    label: 'Feasibility',
    description: 'How realistic is the proposed approach?',
  },
  {
    key: 'constitutional' as const,
    label: 'Constitutional Alignment',
    description: 'How well does this align with the Constitution?',
  },
  {
    key: 'value' as const,
    label: 'Value for Money',
    description: 'Is the budget proportionate to the expected value?',
  },
];

// ---------------------------------------------------------------------------
// Star rating component
// ---------------------------------------------------------------------------

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-colors"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(star)}
        >
          <Star
            className={`h-5 w-5 ${
              (hover ?? value ?? 0) >= star
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
      {value != null && <span className="ml-1.5 text-xs text-muted-foreground">{value}/5</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReviewRubricProps {
  draftId: string;
  reviewerStakeAddress: string;
  onSuccess: () => void;
}

export function ReviewRubric({ draftId, reviewerStakeAddress, onSuccess }: ReviewRubricProps) {
  const submitReview = useSubmitReview(draftId);

  const [scores, setScores] = useState<Record<string, number | null>>({
    impact: null,
    feasibility: null,
    constitutional: null,
    value: null,
  });
  const [feedbackText, setFeedbackText] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [themes, setThemes] = useState<string[]>([]);

  const handleAddTheme = useCallback(() => {
    const trimmed = themeInput.trim();
    if (trimmed && themes.length < 10 && trimmed.length <= 100 && !themes.includes(trimmed)) {
      setThemes((prev) => [...prev, trimmed]);
      setThemeInput('');
    }
  }, [themeInput, themes]);

  const handleRemoveTheme = useCallback((theme: string) => {
    setThemes((prev) => prev.filter((t) => t !== theme));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!feedbackText.trim()) return;

    await submitReview.mutateAsync({
      reviewerStakeAddress,
      impactScore: scores.impact ?? undefined,
      feasibilityScore: scores.feasibility ?? undefined,
      constitutionalScore: scores.constitutional ?? undefined,
      valueScore: scores.value ?? undefined,
      feedbackText: feedbackText.trim(),
      feedbackThemes: themes.length > 0 ? themes : undefined,
    });

    // Reset form
    setScores({ impact: null, feasibility: null, constitutional: null, value: null });
    setFeedbackText('');
    setThemes([]);
    onSuccess();
  }, [submitReview, reviewerStakeAddress, scores, feedbackText, themes, onSuccess]);

  return (
    <Card data-review-rubric>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Submit Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Scoring dimensions */}
        {DIMENSIONS.map((dim) => (
          <div key={dim.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{dim.label}</Label>
              <StarRating
                value={scores[dim.key]}
                onChange={(v) => setScores((prev) => ({ ...prev, [dim.key]: v }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">{dim.description}</p>
          </div>
        ))}

        {/* Feedback text */}
        <div className="space-y-1.5">
          <Label htmlFor="review-feedback">Feedback</Label>
          <Textarea
            id="review-feedback"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share your analysis and recommendations..."
            rows={5}
            maxLength={10000}
          />
          <p
            className={`text-xs ${
              feedbackText.length > 9000
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            }`}
          >
            {feedbackText.length} / 10000
          </p>
        </div>

        {/* Feedback themes */}
        <div className="space-y-1.5">
          <Label>Feedback Themes</Label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTheme();
                }
              }}
              placeholder="Add a theme (e.g., Budget concerns)"
              maxLength={100}
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTheme}
              disabled={!themeInput.trim() || themes.length >= 10}
            >
              Add
            </Button>
          </div>
          {themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {themes.map((theme) => (
                <Badge key={theme} variant="secondary" className="text-xs gap-1">
                  {theme}
                  <button
                    type="button"
                    onClick={() => handleRemoveTheme(theme)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{themes.length} / 10 themes</p>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitReview.isPending || !feedbackText.trim()}
          className="w-full"
        >
          {submitReview.isPending ? (
            'Submitting...'
          ) : (
            <>
              <Send className="mr-1.5 h-4 w-4" />
              Submit Review
            </>
          )}
        </Button>

        {submitReview.isError && (
          <p className="text-xs text-destructive">
            {submitReview.error instanceof Error
              ? submitReview.error.message
              : 'Failed to submit review'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
