/**
 * Shared design tokens and components for OG image generation.
 * All OG routes import from here for visual consistency.
 */

export const OG = {
  bg: '#0c1222',
  bgGradient: '#162033',
  bgCard: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  indigo: '#6366f1',
  barBg: '#1e293b',
  brand: '#6366f1',
} as const;

export function tierColor(score: number): string {
  if (score >= 80) return OG.green;
  if (score >= 60) return OG.amber;
  return OG.red;
}

export function tierLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Low';
}

export function OGBackground({ children, glow }: { children: React.ReactNode; glow?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${OG.bg} 0%, ${OG.bgGradient} 100%)`,
        color: OG.text,
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {glow && (
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${glow}15 0%, transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

export function OGScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const color = tierColor(score);
  const strokeWidth = Math.max(8, size * 0.065);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={OG.barBg}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        {/* Glow effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth * 2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          opacity={0.15}
        />
      </svg>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{ display: 'flex', fontSize: size * 0.3, fontWeight: 700, color, lineHeight: 1 }}
        >
          {score}
        </div>
        <div
          style={{ display: 'flex', fontSize: size * 0.1, color: OG.textMuted, marginTop: '4px' }}
        >
          {tierLabel(score)}
        </div>
      </div>
    </div>
  );
}

export function OGPillarBar({
  label,
  value,
  maxPoints,
}: {
  label: string;
  value: number;
  maxPoints: number;
}) {
  const percentage = Math.min(100, Math.max(0, (value / maxPoints) * 100));
  const barColor = percentage >= 80 ? OG.green : percentage >= 50 ? OG.amber : OG.red;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', width: '140px', fontSize: '18px', color: OG.textMuted }}>
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          height: '24px',
          backgroundColor: OG.barBg,
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: '12px',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          width: '70px',
          fontSize: '18px',
          color: OG.text,
          fontWeight: 600,
          justifyContent: 'flex-end',
        }}
      >
        {Math.round(value)}/{maxPoints}
      </div>
    </div>
  );
}

export function OGFooter({ left, right }: { left?: string; right?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        bottom: '32px',
        left: '64px',
        right: '64px',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', fontSize: '24px', fontWeight: 700, color: OG.brand }}>
        {left || '$drepscore'}
      </div>
      <div style={{ display: 'flex', fontSize: '18px', color: OG.textDim }}>
        {right || 'drepscore.io'}
      </div>
    </div>
  );
}

export function OGFallback({ message }: { message: string }) {
  return (
    <OGBackground>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700, color: OG.brand }}>
          $drepscore
        </div>
        <div style={{ display: 'flex', fontSize: '24px', color: OG.textMuted, marginTop: '16px' }}>
          {message}
        </div>
      </div>
    </OGBackground>
  );
}

export function shortenDRepId(drepId: string): string {
  if (drepId.length <= 20) return drepId;
  return `${drepId.slice(0, 12)}...${drepId.slice(-8)}`;
}

export function formatAdaCompact(lovelace: number | string): string {
  const num = typeof lovelace === 'string' ? parseInt(lovelace, 10) : lovelace;
  const ada = num / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return Math.round(ada).toLocaleString();
}
