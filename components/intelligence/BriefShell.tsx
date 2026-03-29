'use client';

/**
 * BriefShell — scrollable container for intelligence brief sections.
 *
 * Iterates an ordered list of SectionConfig and renders each child section
 * inside a consistent collapsible card. Matches the IntelCard pattern from
 * IntelPanel but in a continuous scroll layout.
 */

import { useState, useCallback, type ReactNode } from 'react';
import {
  Shield,
  Target,
  Search,
  AlertTriangle,
  MessageSquareText,
  ListChecks,
  ShieldCheck,
  Activity,
  FileText,
  Zap,
  Users,
  UserCheck,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import type { SectionConfig, SectionId } from '@/lib/workspace/intelligence/types';

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, typeof Shield> = {
  Shield,
  Target,
  Search,
  AlertTriangle,
  MessageSquareText,
  ListChecks,
  ShieldCheck,
  Activity,
  FileText,
  Zap,
  Users,
  UserCheck,
  HelpCircle,
};

// ---------------------------------------------------------------------------
// BriefSection — individual collapsible card
// ---------------------------------------------------------------------------

function BriefSection({
  config,
  children,
  stage,
}: {
  config: SectionConfig;
  children: ReactNode;
  stage?: string;
}) {
  const [expanded, setExpanded] = useState(config.defaultExpanded);
  const Icon = ICON_MAP[config.icon] ?? Shield;

  const handleToggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      posthog.capture('intelligence_section_expanded', {
        section_id: config.id,
        stage: stage ?? 'unknown',
      });
    }
  }, [expanded, config.id, stage]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">{config.title}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-150',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BriefShell — the scrollable container
// ---------------------------------------------------------------------------

export interface BriefShellProps {
  sections: SectionConfig[];
  /** Render function for each section — receives the section config */
  renderSection: (config: SectionConfig) => ReactNode;
  /** Current stage (for analytics) */
  stage?: string;
  className?: string;
}

export function BriefShell({ sections, renderSection, stage, className }: BriefShellProps) {
  return (
    <div className={cn('space-y-2 overflow-y-auto', className)}>
      {sections.map((config) => (
        <BriefSection key={`${config.id}-${config.defaultExpanded}`} config={config} stage={stage}>
          {renderSection(config)}
        </BriefSection>
      ))}
    </div>
  );
}

// Re-export for convenience
export type { SectionConfig, SectionId };
