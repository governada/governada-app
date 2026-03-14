'use client';

import { motion } from 'framer-motion';
import { MessageSquare, ExternalLink, Copy, Check, Server } from 'lucide-react';
import { useState } from 'react';
import { spring } from '@/lib/animations';

interface SpoIdentityCardProps {
  poolId: string;
  governanceStatement: string | null;
  pledge: string;
  liveStake: string;
  delegatorCount: number;
  totalVotes: number;
  homepage: string | null;
}

function formatAda(lovelace: number | string | null | undefined): string {
  if (lovelace == null) return '\u2014';
  const n = typeof lovelace === 'string' ? parseInt(lovelace, 10) : lovelace;
  if (isNaN(n)) return '\u2014';
  const ada = n / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return ada.toFixed(0);
}

export function SpoIdentityCard({
  poolId,
  governanceStatement,
  pledge,
  liveStake,
  delegatorCount,
  totalVotes,
  homepage,
}: SpoIdentityCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(poolId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-4"
    >
      {/* Governance Statement */}
      {governanceStatement && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Governance Statement
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-primary/30 pl-3">
            {governanceStatement}
          </p>
        </div>
      )}

      {/* Pool Details */}
      <div className="space-y-2">
        {!governanceStatement && (
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pool Details
            </span>
          </div>
        )}
        {governanceStatement && (
          <div className="border-t border-border/30 pt-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pool Details
            </span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Pledge</p>
            <p className="text-sm font-mono tabular-nums font-medium">
              {Number(pledge) > 0 ? `${formatAda(pledge)} \u20B3` : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Live Stake</p>
            <p className="text-sm font-mono tabular-nums font-medium">
              {Number(liveStake) > 0 ? `${formatAda(liveStake)} \u20B3` : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Delegators</p>
            <p className="text-sm font-mono tabular-nums font-medium">
              {delegatorCount > 0 ? delegatorCount.toLocaleString() : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Governance Votes</p>
            <p className="text-sm font-mono tabular-nums font-medium">{totalVotes}</p>
          </div>
        </div>
      </div>

      {/* Footer: Pool ID + External Link */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/30 pt-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          title="Copy pool ID"
        >
          <span className="font-mono truncate max-w-[200px]">
            {poolId.slice(0, 16)}&hellip;{poolId.slice(-8)}
          </span>
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
          )}
        </button>
        {homepage && (
          <a
            href={homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Pool homepage
          </a>
        )}
      </div>
    </motion.div>
  );
}
