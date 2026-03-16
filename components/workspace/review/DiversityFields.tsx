'use client';

import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VoteChoice } from '@/lib/voting';

interface DiversityFieldsProps {
  steelmanText: string;
  onSteelmanChange: (text: string) => void;
  confidence: number;
  onConfidenceChange: (value: number) => void;
  keyAssumptions: string;
  onAssumptionsChange: (text: string) => void;
  selectedVote: VoteChoice | null;
}

/**
 * DiversityFields — steelman, confidence slider, and key assumptions.
 * Renders below the rationale editor in ReviewActionZone to encourage
 * deliberative depth and diverse thinking.
 */
export function DiversityFields({
  steelmanText,
  onSteelmanChange,
  confidence,
  onConfidenceChange,
  keyAssumptions,
  onAssumptionsChange,
  selectedVote,
}: DiversityFieldsProps) {
  const needsSteelman = selectedVote === 'No' || selectedVote === 'Abstain';
  const steelmanMissing = needsSteelman && steelmanText.trim().length === 0;

  return (
    <div className="space-y-4 border-t border-border/50 pt-4">
      {/* Steelman */}
      <div className="space-y-1.5">
        <Label htmlFor="steelman-field" className="text-xs">
          What&apos;s the strongest case against your position?
        </Label>
        <Textarea
          id="steelman-field"
          value={steelmanText}
          onChange={(e) => onSteelmanChange(e.target.value)}
          placeholder="Consider the strongest argument for the opposing view..."
          className="min-h-[80px] text-sm resize-y"
          maxLength={5000}
        />
        <div className="flex items-center justify-between">
          {steelmanMissing && (
            <div className="flex items-center gap-1 text-[10px] text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              Recommended when voting No or Abstain
            </div>
          )}
          <p className="text-[10px] text-muted-foreground tabular-nums ml-auto">
            {steelmanText.length.toLocaleString()} / 5,000
          </p>
        </div>
      </div>

      {/* Confidence Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="confidence-slider" className="text-xs">
            How confident are you?
          </Label>
          <span className="text-xs font-medium tabular-nums text-foreground">{confidence}%</span>
        </div>
        <input
          id="confidence-slider"
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={(e) => onConfidenceChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Very uncertain</span>
          <span>Very confident</span>
        </div>
      </div>

      {/* Key Assumptions */}
      <div className="space-y-1.5">
        <Label htmlFor="assumptions-field" className="text-xs">
          What assumptions are you making?
        </Label>
        <Textarea
          id="assumptions-field"
          value={keyAssumptions}
          onChange={(e) => onAssumptionsChange(e.target.value)}
          placeholder="E.g., 'This assumes the team can deliver on time' or 'This relies on current market conditions'..."
          className="min-h-[60px] text-sm resize-y"
          maxLength={5000}
        />
        <p className="text-[10px] text-muted-foreground tabular-nums text-right">
          {keyAssumptions.length.toLocaleString()} / 5,000
        </p>
      </div>
    </div>
  );
}
