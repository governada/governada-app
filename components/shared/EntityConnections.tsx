'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  User,
  FileText,
  Building2,
  Shield,
  Vote,
  TrendingUp,
  Users,
  Link2,
  ChevronRight,
  Network,
} from 'lucide-react';
import { useEntityConnections } from '@/hooks/useEntityConnections';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EntityType, EntityConnection } from '@/lib/entityConnections';

const ICON_MAP = {
  user: User,
  'file-text': FileText,
  building: Building2,
  shield: Shield,
  vote: Vote,
  trending: TrendingUp,
  users: Users,
  link: Link2,
} as const;

function ConnectionItem({ connection }: { connection: EntityConnection }) {
  const Icon = ICON_MAP[connection.icon] ?? Link2;

  return (
    <Link
      href={connection.href}
      className={cn(
        'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50',
        connection.personalized && 'border-l-2 border-primary/50 bg-primary/5',
      )}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug truncate">{connection.label}</p>
        {connection.sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{connection.sublabel}</p>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground/30" />
    </Link>
  );
}

function ConnectionList({ connections }: { connections: EntityConnection[] }) {
  if (connections.length === 0) return null;

  return (
    <div className="divide-y divide-border/30">
      {connections.map((conn, idx) => (
        <ConnectionItem key={`${conn.href}-${idx}`} connection={conn} />
      ))}
    </div>
  );
}

interface EntityConnectionsProps {
  entityType: EntityType;
  entityId: string;
}

/**
 * Connected Graph panel for entity pages.
 *
 * Desktop: Collapsible right-side panel (hidden by default, badge shows count).
 * Mobile: "See connections" button → bottom sheet.
 */
export function EntityConnections({ entityType, entityId }: EntityConnectionsProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useEntityConnections(entityType, entityId);
  const [expanded, setExpanded] = useState(false);

  const connections = data?.connections ?? [];

  // Don't render anything while loading or if no connections
  if (isLoading || connections.length === 0) return null;

  const personalCount = connections.filter((c) => c.personalized).length;

  return (
    <>
      {/* Desktop: collapsible panel */}
      <div className="hidden lg:block">
        {!expanded ? (
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="gap-2">
            <Network className="h-4 w-4" />
            {connections.length} {t('connections')}
            {personalCount > 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
          </Button>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden w-72">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t('Connected')}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setExpanded(false)}
              >
                {t('Hide')}
              </Button>
            </div>
            <ConnectionList connections={connections} />
          </div>
        )}
      </div>

      {/* Mobile: sheet trigger */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Network className="h-4 w-4" />
              {connections.length} {t('connections')}
              {personalCount > 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>{t('Connected')}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto mt-4">
              <ConnectionList connections={connections} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
