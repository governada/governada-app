'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ArrowRight, Clock } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useLocale } from '@/components/providers/LocaleProvider';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { SUPPORTED_LOCALES, LOCALE_NAMES, type SupportedLocale } from '@/lib/i18n/config';
import { getStoredSession } from '@/lib/supabaseAuth';
import type { GovernanceDepth } from '@/lib/governanceTuner';
import { cn } from '@/lib/utils';
import {
  PAGE_COMMANDS,
  HELP_COMMANDS,
  GOVERNANCE_ACTIONS,
  buildActionCommands,
  buildSettingsCommands,
  buildLanguageCommands,
  filterBySegment,
  searchDReps,
  searchProposals,
  getPageLabel,
  type CommandItem,
  type SearchableDRep,
  type SearchableProposal,
} from '@/lib/commandIndex';
import {
  getRecentDestinations,
  addRecentDestination,
  type RecentDestination,
} from '@/lib/recentDestinations';

// ---------------------------------------------------------------------------
// Governance depth mutation (save to server)
// ---------------------------------------------------------------------------

async function saveGovernanceDepth(depth: GovernanceDepth): Promise<void> {
  const token = getStoredSession();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/user', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ governance_depth: depth }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to save');
  }
}

// ---------------------------------------------------------------------------
// Recent destinations tracker
// ---------------------------------------------------------------------------

function useTrackDestinations() {
  const pathname = usePathname();
  useEffect(() => {
    const label = getPageLabel(pathname);
    if (label) addRecentDestination(pathname, label);
  }, [pathname]);
}

// ---------------------------------------------------------------------------
// Command Palette component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, logout } = useWallet();
  const { segment } = useSegment();
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const { depth } = useGovernanceDepth();
  const { locale, setLocale } = useLocale();
  const queryClient = useQueryClient();

  // Track page visits for recent destinations
  useTrackDestinations();

  // Recent destinations state — refreshed when palette opens
  const [recentItems, setRecentItems] = useState<RecentDestination[]>([]);
  useEffect(() => {
    if (open) {
      setRecentItems(getRecentDestinations());
    }
  }, [open]);

  // ── Keyboard shortcut to open ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Pre-index entity data via TanStack Query ──────────────────────────
  // Fetch on first palette open, then cache forever (staleTime: Infinity)
  const hasOpenedOnce = useRef(false);
  useEffect(() => {
    if (open) hasOpenedOnce.current = true;
  }, [open]);

  const { data: drepData } = useQuery({
    queryKey: ['command-palette-dreps'],
    queryFn: () =>
      fetch('/api/dreps?limit=500&fields=drepId,name,ticker,drepScore')
        .then((r) => (r.ok ? r.json() : { dreps: [] }))
        .then((d) => (d.dreps || d || []) as SearchableDRep[]),
    staleTime: Infinity,
    enabled: hasOpenedOnce.current,
  });

  const { data: proposalData } = useQuery({
    queryKey: ['command-palette-proposals'],
    queryFn: () =>
      fetch('/api/proposals?limit=100&fields=txHash,index,title,status,type')
        .then((r) => (r.ok ? r.json() : { proposals: [] }))
        .then((d) => (d.proposals || d || []) as SearchableProposal[]),
    staleTime: Infinity,
    enabled: hasOpenedOnce.current,
  });

  const dreps = drepData ?? [];
  const proposals = proposalData ?? [];

  // ── Governance depth mutation ──────────────────────────────────────────
  const depthMutation = useMutation({
    mutationFn: saveGovernanceDepth,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('governance_depth_changed', {
            from: depth,
            to: depthMutation.variables,
            source: 'command_palette',
          });
        })
        .catch(() => {});
    },
  });

  const handleSetDepth = useCallback(
    (newDepth: string) => {
      depthMutation.mutate(newDepth as GovernanceDepth);
    },
    [depthMutation],
  );

  const handleSetLocale = useCallback(
    (newLocale: string) => {
      setLocale(newLocale as SupportedLocale);
    },
    [setLocale],
  );

  // ── Wallet actions ─────────────────────────────────────────────────────
  const openWallet = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openWalletConnect', { detail: {} }));
  }, []);

  // ── Build command lists ────────────────────────────────────────────────
  const actionCommands = buildActionCommands({
    openWallet,
    isAuthenticated,
    logout,
  });

  const settingsCommands = useMemo(
    () =>
      buildSettingsCommands({
        setDepth: handleSetDepth,
        currentDepth: depth,
      }),
    [handleSetDepth, depth],
  );

  const languageCommands = useMemo(
    () =>
      buildLanguageCommands({
        setLocale: handleSetLocale,
        currentLocale: locale,
        localeNames: LOCALE_NAMES,
        supportedLocales: SUPPORTED_LOCALES,
      }),
    [handleSetLocale, locale],
  );

  // ── Filter by segment ─────────────────────────────────────────────────
  const filteredPages = useMemo(() => filterBySegment(PAGE_COMMANDS, segment), [segment]);
  const filteredGovActions = useMemo(() => filterBySegment(GOVERNANCE_ACTIONS, segment), [segment]);
  const filteredSettings = useMemo(
    () => filterBySegment(settingsCommands, segment),
    [settingsCommands, segment],
  );

  // ── Search ─────────────────────────────────────────────────────────────
  const drepResults = searchDReps(dreps, query);
  const proposalResults = searchProposals(proposals, query);

  // Filter static commands by query (1+ chars for pages/actions/help/settings)
  const q = query.toLowerCase().trim();
  const matchesQuery = useCallback(
    (item: CommandItem) => {
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        (item.sublabel?.toLowerCase().includes(q) ?? false) ||
        item.id.toLowerCase().includes(q)
      );
    },
    [q],
  );

  const visiblePages = q ? filteredPages.filter(matchesQuery) : filteredPages;
  const visibleHelp = q ? HELP_COMMANDS.filter(matchesQuery) : HELP_COMMANDS;
  const visibleGovActions = q ? filteredGovActions.filter(matchesQuery) : filteredGovActions;
  const visibleActions = q ? actionCommands.filter(matchesQuery) : actionCommands;
  const visibleSettings = q ? [...filteredSettings, ...languageCommands].filter(matchesQuery) : [];
  // Only show language + depth settings when user is searching for them
  // (to avoid cluttering the empty-query view with 13 language options)

  // Show recent destinations only when query is empty
  const visibleRecents =
    !q && recentItems.length > 0
      ? recentItems.map(
          (r): CommandItem => ({
            id: `recent-${r.href}`,
            label: r.label,
            group: 'recent',
            icon: Clock,
            href: r.href,
          }),
        )
      : [];

  // ── Epoch info for context header ──────────────────────────────────────
  const daysRemaining = totalDays - day;
  const epochLabel = `Epoch ${epoch}`;
  const timeLabel = daysRemaining > 0 ? `${daysRemaining}d remaining` : 'Ending today';
  const proposalLabel =
    activeProposalCount !== null ? `${activeProposalCount} active proposals` : '';
  const contextLine = [epochLabel, timeLabel, proposalLabel].filter(Boolean).join(' \u00B7 ');

  // ── Select handler ─────────────────────────────────────────────────────
  const onSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setQuery('');
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
      if (item.id === 'action-shortcuts') {
        window.dispatchEvent(new CustomEvent('openShortcutsHelp'));
      }
    },
    [router],
  );

  // ── Group heading classes ──────────────────────────────────────────────
  const groupCls =
    '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground';
  const itemCls =
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors';

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t('Command palette')}
      className="fixed inset-0 z-[100]"
      shouldFilter={false}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
        <div className="rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden ring-1 ring-white/5">
          {/* Governance context header */}
          <div className="text-[11px] text-muted-foreground px-3 py-1.5 border-b border-border/30 font-mono">
            {contextLine}
          </div>

          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border/50 px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={t('Search DReps, proposals, pages...')}
              className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[360px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              {t('No results found.')}
            </Command.Empty>

            {/* Recent destinations (empty query only) */}
            {visibleRecents.length > 0 && (
              <Command.Group heading={t('Recent')} className={groupCls}>
                {visibleRecents.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      onSelect={() => onSelect(item)}
                      className={itemCls}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* DRep results */}
            {drepResults.length > 0 && (
              <Command.Group heading={t('DReps')} className={groupCls}>
                {drepResults.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className={cn(itemCls, 'py-2.5')}
                  >
                    {item.score !== undefined && (
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold font-mono bg-primary/10 text-primary shrink-0">
                        {item.score}
                      </span>
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground font-mono">
                        ${item.sublabel}
                      </span>
                    )}
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Proposal results */}
            {proposalResults.length > 0 && (
              <Command.Group heading={t('Proposals')} className={groupCls}>
                {proposalResults.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className={cn(itemCls, 'py-2.5')}
                  >
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground capitalize">
                        {item.sublabel}
                      </span>
                    )}
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Governance actions (persona-specific) */}
            {visibleGovActions.length > 0 && (
              <Command.Group heading={t('Governance')} className={groupCls}>
                {visibleGovActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.id} ${item.label}`}
                      onSelect={() => onSelect(item)}
                      className={itemCls}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{t(item.label)}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {t(item.sublabel)}
                        </span>
                      )}
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Pages */}
            {visiblePages.length > 0 && (
              <Command.Group heading={t('Pages')} className={groupCls}>
                {visiblePages.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.id} ${item.label}`}
                      onSelect={() => onSelect(item)}
                      className={itemCls}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{t(item.label)}</span>
                      {item.shortcut && (
                        <kbd className="ml-auto text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Help */}
            {visibleHelp.length > 0 && (
              <Command.Group heading={t('Help')} className={groupCls}>
                {visibleHelp.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.id} ${item.label}`}
                      onSelect={() => onSelect(item)}
                      className={itemCls}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{t(item.label)}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Actions */}
            {visibleActions.length > 0 && (
              <Command.Group heading={t('Actions')} className={groupCls}>
                {visibleActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.id} ${item.label}`}
                      onSelect={() => onSelect(item)}
                      className={itemCls}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{t(item.label)}</span>
                      {item.shortcut && (
                        <kbd className="ml-auto text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Settings (depth + language — shown only when searching) */}
            {visibleSettings.length > 0 && (
              <Command.Group heading={t('Settings')} className={groupCls}>
                {visibleSettings.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`${item.id} ${item.label}`}
                      onSelect={() => onSelect(item)}
                      className={itemCls}
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{t(item.label)}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {t(item.sublabel)}
                        </span>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div
            className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground"
            aria-hidden="true"
          >
            <span>
              <kbd className="font-mono">&#8593;&#8595;</kbd> {t('Navigate')}{' '}
              <kbd className="font-mono">&#8629;</kbd> {t('Select')}{' '}
              <kbd className="font-mono">esc</kbd> {t('Close')}
            </span>
            <span className="font-mono text-primary/60">$governada</span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}
