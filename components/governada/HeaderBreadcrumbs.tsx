'use client';

import { createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

/**
 * Context for entity pages to inject a human-readable name into the breadcrumb.
 * E.g., a DRep profile page sets entityName="Ada Lovelace" so the breadcrumb
 * shows "Representatives > Ada Lovelace" instead of just "Representatives > DRep".
 */
const BreadcrumbEntityContext = createContext<string | null>(null);

export function BreadcrumbEntityProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <BreadcrumbEntityContext.Provider value={name}>{children}</BreadcrumbEntityContext.Provider>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  governance: 'Governance',
  proposals: 'Proposals',
  representatives: 'Representatives',
  pools: 'Pools',
  committee: 'Committee',
  treasury: 'Treasury',
  health: 'Health',
  you: 'You',
  workspace: 'Workspace',
  match: 'Match',
  help: 'Help',
  settings: 'Settings',
  admin: 'Admin',
  review: 'Review',
  author: 'Author',
  votes: 'Votes',
  delegators: 'Delegators',
  delegation: 'Delegation',
  identity: 'Identity',
  drep: 'DRep',
  spo: 'SPO',
  proposal: 'Proposal',
};

interface BreadcrumbSegment {
  label: string;
  href: string;
}

function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  if (pathname === '/') return [];

  const parts = pathname.split('/').filter(Boolean);
  const segments: BreadcrumbSegment[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const href = '/' + parts.slice(0, i + 1).join('/');

    // Skip dynamic segments (entity IDs) — they'd show a hash/ID which isn't readable
    const label = ROUTE_LABELS[part];
    if (!label) continue;

    segments.push({ label, href });
  }

  // Limit to 3 segments max
  return segments.slice(0, 3);
}

/**
 * Route-based breadcrumbs for the header.
 * Desktop: full path with separators.
 * Mobile: "Back to {parent}" link.
 */
export function HeaderBreadcrumbs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const entityName = useContext(BreadcrumbEntityContext);

  const segments = buildBreadcrumbs(pathname);

  // If an entity page provides a name, append it as the final breadcrumb segment
  if (entityName && segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    // Only append if the last segment is a generic route label (not already the entity name)
    if (lastSegment && ROUTE_LABELS[lastSegment.label.toLowerCase()]) {
      segments.push({ label: entityName, href: pathname });
    }
  }

  if (segments.length === 0) return null;

  const parentSegment = segments.length >= 2 ? segments[segments.length - 2] : null;

  return (
    <>
      {/* Desktop breadcrumbs */}
      <nav aria-label={t('Breadcrumb')} className="hidden md:block ml-4">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          {segments.map((segment, index) => {
            const isLast = index === segments.length - 1;
            return (
              <li key={segment.href} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight
                    className="h-3 w-3 shrink-0 text-muted-foreground/40"
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span className={cn('text-foreground/80 font-medium')} aria-current="page">
                    {t(segment.label)}
                  </span>
                ) : (
                  <Link href={segment.href} className="hover:text-foreground transition-colors">
                    {t(segment.label)}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile back link — shown below md breakpoint but only when header is visible (md:block on header) */}
      {parentSegment && (
        <nav aria-label={t('Breadcrumb')} className="md:hidden ml-3">
          <Link
            href={parentSegment.href}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            <span>
              {t('Back to')} {t(parentSegment.label)}
            </span>
          </Link>
        </nav>
      )}
    </>
  );
}
