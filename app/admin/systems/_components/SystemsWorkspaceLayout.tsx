'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, History, Radar, ShieldAlert, Siren, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemsWorkspaceSection } from '@/lib/admin/systems';

const NAV_ITEMS: Array<{
  section: SystemsWorkspaceSection;
  label: string;
  href: string;
  icon: typeof Radar;
  summary: string;
}> = [
  {
    section: 'launch',
    label: 'Launch',
    href: '/admin/systems/launch',
    icon: Radar,
    summary: 'Launch decision, blockers, proof freshness',
  },
  {
    section: 'queue',
    label: 'Queue',
    href: '/admin/systems/queue',
    icon: ClipboardList,
    summary: 'Founder work queue and review loop',
  },
  {
    section: 'incidents',
    label: 'Incidents',
    href: '/admin/systems/incidents',
    icon: Siren,
    summary: 'Incident state, drills, and transitions',
  },
  {
    section: 'evidence',
    label: 'Evidence',
    href: '/admin/systems/evidence',
    icon: ShieldAlert,
    summary: 'SLOs, journey proof, trust, performance',
  },
  {
    section: 'history',
    label: 'History',
    href: '/admin/systems/history',
    icon: History,
    summary: 'Reviews, sweeps, escalations, event trail',
  },
];

export function SystemsWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.06),transparent_28%)]">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-2 text-amber-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Systems Command Center
              </p>
              <p className="text-sm text-muted-foreground">
                Replace the long-scroll cockpit with focused founder workspaces.
              </p>
            </div>
          </div>

          <nav aria-label="Systems workspace navigation" className="grid gap-2 md:grid-cols-5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-2xl border p-3 transition-all',
                    active
                      ? 'border-slate-900 bg-slate-950 text-slate-50 shadow-lg shadow-slate-950/15'
                      : 'border-border/70 bg-card/80 text-foreground hover:border-border hover:bg-card',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Icon
                      className={cn('h-4 w-4', active ? 'text-amber-300' : 'text-muted-foreground')}
                    />
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {item.section}
                    </span>
                  </div>
                  <p className="text-sm font-semibold tracking-tight">{item.label}</p>
                  <p
                    className={cn(
                      'mt-1 text-xs leading-5',
                      active ? 'text-slate-300' : 'text-muted-foreground',
                    )}
                  >
                    {item.summary}
                  </p>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
    </div>
  );
}
