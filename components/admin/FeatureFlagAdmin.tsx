'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FlagDetail {
  key: string;
  enabled: boolean;
  description: string | null;
  category: string;
  updatedAt: string;
}

interface CategoryGroup {
  category: string;
  flags: FlagDetail[];
  enabledCount: number;
}

export function FeatureFlagAdmin({ adminAddress }: { adminAddress: string }) {
  const [flags, setFlags] = useState<FlagDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feature-flags');
      if (!res.ok) return;
      const data = await res.json();
      setFlags(data.details ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, FlagDetail[]>();
    for (const f of flags) {
      const cat = f.category || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, catFlags]) => ({
        category,
        flags: catFlags,
        enabledCount: catFlags.filter((f) => f.enabled).length,
      }));
  }, [flags]);

  const toggle = async (key: string, enabled: boolean) => {
    setToggling(key);
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled, address: adminAddress }),
      });
      if (res.ok) {
        setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));
      }
    } catch {
      // silent
    } finally {
      setToggling(null);
    }
  };

  const toggleCollapse = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading flags...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {flags.length} flags across {groups.length} categories
        </p>
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 text-xs">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {groups.map(({ category, flags: catFlags, enabledCount }) => {
        const isCollapsed = collapsed.has(category);
        return (
          <Card key={category}>
            <CardHeader
              className="cursor-pointer select-none py-3 px-4"
              onClick={() => toggleCollapse(category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-sm font-semibold">{category}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {enabledCount}/{catFlags.length}
                  </Badge>
                </div>
                {enabledCount === catFlags.length ? (
                  <Badge className="text-[10px] bg-green-500/15 text-green-600 border-green-500/30">
                    All ON
                  </Badge>
                ) : enabledCount === 0 ? (
                  <Badge variant="destructive" className="text-[10px]">
                    All OFF
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Partial
                  </Badge>
                )}
              </div>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="pt-0 pb-2 px-4 space-y-1">
                {catFlags.map((flag) => (
                  <div
                    key={flag.key}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 transition-colors',
                      'hover:bg-muted/50',
                    )}
                  >
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => toggle(flag.key, checked)}
                      disabled={toggling === flag.key}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-medium">{flag.key}</code>
                        <Badge
                          variant={flag.enabled ? 'default' : 'secondary'}
                          className="text-[9px] px-1 py-0"
                        >
                          {flag.enabled ? 'ON' : 'OFF'}
                        </Badge>
                      </div>
                      {flag.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {flag.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center shrink-0">
                      {toggling === flag.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : flag.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}

      {flags.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No feature flags found. Add them via the database.
        </p>
      )}
    </div>
  );
}
