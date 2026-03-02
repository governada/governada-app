'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlagDetail {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
}

export function FeatureFlagAdmin() {
  const [flags, setFlags] = useState<FlagDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feature-flags');
      if (!res.ok) return;
      const data = await res.json();
      setFlags(data.details ?? []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (key: string, enabled: boolean) => {
    setToggling(key);
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      });
      if (res.ok) {
        setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
      }
    } catch {
      // Silently fail
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading flags...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-xs">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {flags.map(flag => (
        <Card key={flag.key}>
          <CardContent className="flex items-center gap-4 p-4">
            <Switch
              checked={flag.enabled}
              onCheckedChange={(checked) => toggle(flag.key, checked)}
              disabled={toggling === flag.key}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-medium">{flag.key}</code>
                <Badge variant={flag.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {flag.enabled ? 'ON' : 'OFF'}
                </Badge>
              </div>
              {flag.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
              )}
            </div>
            <div className="flex items-center shrink-0">
              {toggling === flag.key ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : flag.enabled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {flags.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No feature flags found. Add them via the database.
        </p>
      )}
    </div>
  );
}
