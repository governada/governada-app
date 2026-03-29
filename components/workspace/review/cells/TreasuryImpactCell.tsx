'use client';

export function TreasuryImpactCell({
  amount,
  tier,
}: {
  amount: number | null;
  tier: string | null;
}) {
  if (amount == null || amount <= 0) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  let formatted: string;
  if (amount >= 1_000_000) {
    formatted = `${(amount / 1_000_000).toFixed(1)}M`;
  } else if (amount >= 1_000) {
    formatted = `${Math.round(amount / 1_000)}K`;
  } else {
    formatted = amount.toLocaleString();
  }

  return (
    <div className="text-xs">
      <span className="font-medium text-foreground">₳{formatted}</span>
      {tier && <span className="ml-1 text-muted-foreground/60">{tier}</span>}
    </div>
  );
}
