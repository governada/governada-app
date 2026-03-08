'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useWallet } from '@/utils/wallet';
import { Search, ArrowRight } from 'lucide-react';
import {
  PAGE_COMMANDS,
  buildActionCommands,
  searchDReps,
  searchProposals,
  type CommandItem,
  type SearchableDRep,
  type SearchableProposal,
} from '@/lib/commandIndex';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { isAuthenticated, logout } = useWallet();

  const [dreps, setDreps] = useState<SearchableDRep[]>([]);
  const [proposals, setProposals] = useState<SearchableProposal[]>([]);
  const dataLoaded = useRef(false);

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

  useEffect(() => {
    if (open && !dataLoaded.current) {
      dataLoaded.current = true;
      fetch('/api/dreps?limit=500&fields=drepId,name,ticker,drepScore')
        .then((r) => (r.ok ? r.json() : { dreps: [] }))
        .then((d) => setDreps(d.dreps || d || []))
        .catch(() => {});
      fetch('/api/proposals?limit=100&fields=txHash,index,title,status,type')
        .then((r) => (r.ok ? r.json() : { proposals: [] }))
        .then((d) => setProposals(d.proposals || d || []))
        .catch(() => {});
    }
  }, [open]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const openWallet = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openWalletConnect', { detail: {} }));
  }, []);

  const actionCommands = buildActionCommands({
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    openWallet,
    isAuthenticated,
    logout,
  });

  const drepResults = searchDReps(dreps, query);
  const proposalResults = searchProposals(proposals, query);

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

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
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
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border/50 px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search DReps, proposals, pages..."
              className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[320px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* DRep results */}
            {drepResults.length > 0 && (
              <Command.Group
                heading="DReps"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {drepResults.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
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
              <Command.Group
                heading="Proposals"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {proposalResults.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
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

            {/* Pages */}
            <Command.Group
              heading="Pages"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {PAGE_COMMANDS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.id} ${item.label}`}
                    onSelect={() => onSelect(item)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {actionCommands.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.id} ${item.label}`}
                    onSelect={() => onSelect(item)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
                  >
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate <kbd className="font-mono">↵</kbd> select{' '}
              <kbd className="font-mono">esc</kbd> close
            </span>
            <span className="font-mono text-primary/60">$drepscore</span>
          </div>
        </div>
      </div>
    </Command.Dialog>
  );
}
