'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getStoredSession } from '@/lib/supabaseAuth';

interface Recommendation {
  txHash: string;
  proposalIndex: number;
  title: string;
  proposalType: string;
  relevanceScore: number;
  alignmentReason: string;
  conflict: boolean;
}

interface ForYouResponse {
  recommendations: Recommendation[];
  profileSource: 'quiz' | 'votes' | 'none';
}

export function ForYouProposals() {
  const [data, setData] = useState<ForYouResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/governance/for-you', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const token = typeof window !== 'undefined' ? getStoredSession() : null;

  if (loading && token) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            For You
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!token || !data || data.profileSource === 'none') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Take the governance quiz to get personalized recommendations
          </p>
          <Button asChild size="sm">
            <Link href="/match">Take the governance quiz</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.recommendations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active proposals match your governance profile right now. Check back later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          For You
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.recommendations.map((rec, i) => (
          <motion.div
            key={`${rec.txHash}-${rec.proposalIndex}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              href={`/proposals/${rec.txHash}/${rec.proposalIndex}`}
              className={`block rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                rec.conflict ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{rec.title}</span>
                    {rec.conflict && (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    {rec.proposalType}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{rec.alignmentReason}</p>
                </div>
                <div className="shrink-0 w-16">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rec.conflict ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, rec.relevanceScore))}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{rec.relevanceScore}%</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
