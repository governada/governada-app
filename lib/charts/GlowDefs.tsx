/**
 * Shared SVG <defs> for chart glow effects and gradients.
 * Used across all custom chart components for consistent visual language.
 */

interface GlowFilterProps {
  id: string;
  stdDeviation?: number;
}

export function GlowFilter({ id, stdDeviation = 4 }: GlowFilterProps) {
  return (
    <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={stdDeviation} />
      <feComposite in2="SourceGraphic" operator="over" />
    </filter>
  );
}

interface AreaGradientProps {
  id: string;
  color: string;
  topOpacity?: number;
  bottomOpacity?: number;
}

export function AreaGradient({
  id,
  color,
  topOpacity = 0.25,
  bottomOpacity = 0,
}: AreaGradientProps) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={topOpacity} />
      <stop offset="95%" stopColor={color} stopOpacity={bottomOpacity} />
    </linearGradient>
  );
}
