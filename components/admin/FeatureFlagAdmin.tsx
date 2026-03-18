'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Users,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStoredSession } from '@/lib/supabaseAuth';

interface FlagDetail {
  key: string;
  enabled: boolean;
  description: string | null;
  category: string;
  targeting?: { wallets?: Record<string, boolean> };
  updatedAt: string;
}

interface CategoryGroup {
  category: string;
  flags: FlagDetail[];
  enabledCount: number;
}

export function FeatureFlagAdmin() {
  const [flags, setFlags] = useState<FlagDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const token = getStoredSession();
      const res = await fetch('/api/admin/feature-flags', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
      const token = getStoredSession();
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ key, enabled }),
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

  // --- User override targeting ---
  const [expandedTargeting, setExpandedTargeting] = useState<string | null>(null);
  const [newOverrideWallet, setNewOverrideWallet] = useState('');
  const [newOverrideEnabled, setNewOverrideEnabled] = useState(true);
  const [savingOverride, setSavingOverride] = useState(false);

  const toggleTargeting = (key: string) => {
    setExpandedTargeting((prev) => (prev === key ? null : key));
    setNewOverrideWallet('');
    setNewOverrideEnabled(true);
  };

  const getOverrides = (flag: FlagDetail): [string, boolean][] => {
    const wallets = flag.targeting?.wallets;
    if (!wallets) return [];
    return Object.entries(wallets);
  };

  const saveOverride = useCallback(
    async (key: string, walletAddress: string, enabled: boolean | null) => {
      setSavingOverride(true);
      try {
        const token = getStoredSession();
        const res = await fetch('/api/admin/feature-flags/targeting', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ key, walletAddress, enabled }),
        });
        if (res.ok) {
          // Update local state
          setFlags((prev) =>
            prev.map((f) => {
              if (f.key !== key) return f;
              const wallets = { ...(f.targeting?.wallets ?? {}) };
              if (enabled === null) {
                delete wallets[walletAddress];
              } else {
                wallets[walletAddress] = enabled;
              }
              return { ...f, targeting: { ...f.targeting, wallets } };
            }),
          );
          setNewOverrideWallet('');
          setNewOverrideEnabled(true);
        }
      } catch {
        // silent
      } finally {
        setSavingOverride(false);
      }
    },
    [],
  );

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
                {catFlags.map((flag) => {
                  const overrides = getOverrides(flag);
                  const isTargetingOpen = expandedTargeting === flag.key;
                  return (
                    <div key={flag.key}>
                      <div
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
                            {overrides.length > 0 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                                <Users className="h-2.5 w-2.5" />
                                {overrides.length}
                              </Badge>
                            )}
                          </div>
                          {flag.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {flag.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleTargeting(flag.key)}
                            title="User overrides"
                          >
                            <Users className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          {toggling === flag.key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : flag.enabled ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                      </div>

                      {/* User Overrides Panel */}
                      {isTargetingOpen && (
                        <div className="ml-12 mr-3 mb-2 mt-1 rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                            User Overrides
                          </p>

                          {overrides.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              No per-user overrides. Global value applies to all users.
                            </p>
                          )}

                          {overrides.map(([wallet, value]) => (
                            <div key={wallet} className="flex items-center gap-2 text-xs">
                              <code className="flex-1 min-w-0 truncate font-mono text-[11px]">
                                {wallet}
                              </code>
                              <Badge
                                variant={value ? 'default' : 'secondary'}
                                className="text-[9px] px-1 py-0 shrink-0"
                              >
                                {value ? 'ON' : 'OFF'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => saveOverride(flag.key, wallet, null)}
                                disabled={savingOverride}
                                title="Remove override"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}

                          {/* Add override form */}
                          <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                            <Input
                              placeholder="stake1... or addr1..."
                              value={newOverrideWallet}
                              onChange={(e) => setNewOverrideWallet(e.target.value)}
                              className="h-7 text-[11px] font-mono flex-1"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-muted-foreground">
                                {newOverrideEnabled ? 'ON' : 'OFF'}
                              </span>
                              <Switch
                                checked={newOverrideEnabled}
                                onCheckedChange={setNewOverrideEnabled}
                                className="scale-75"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] gap-1 shrink-0"
                              onClick={() => {
                                if (newOverrideWallet.trim()) {
                                  saveOverride(
                                    flag.key,
                                    newOverrideWallet.trim(),
                                    newOverrideEnabled,
                                  );
                                }
                              }}
                              disabled={!newOverrideWallet.trim() || savingOverride}
                            >
                              {savingOverride ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
