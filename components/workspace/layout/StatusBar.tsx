'use client';

/**
 * StatusBar — persistent footer showing live governance state indicators.
 *
 * Each indicator is a clickable badge. Data sources will be wired in Phase 2.
 */

import { Shield, ListChecks, Users, Clock, FileText } from 'lucide-react';

interface StatusBarProps {
  constitutional?: { status: 'pass' | 'warning' | 'fail'; flagCount: number };
  completeness?: { done: number; total: number };
  community?: { reviewerCount: number; themeCount: number };
  userStatus?: string;
  deadline?: string;
}

const constitutionalColors = {
  pass: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  fail: 'text-rose-600 dark:text-rose-400',
};

export function StatusBar({
  constitutional,
  completeness,
  community,
  userStatus,
  deadline,
}: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 flex-1">
      {/* Constitutional compliance */}
      {constitutional && (
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <Shield className={`h-3 w-3 ${constitutionalColors[constitutional.status]}`} />
          <span>
            Constitutional: {constitutional.status === 'pass' ? '✓ Pass' : constitutional.status}
            {constitutional.flagCount > 0 && ` | ${constitutional.flagCount} flags`}
          </span>
        </button>
      )}

      {/* Completeness */}
      {completeness && (
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <ListChecks className="h-3 w-3" />
          <span>
            {completeness.done}/{completeness.total} complete
          </span>
        </button>
      )}

      {/* Community */}
      {community && (
        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <Users className="h-3 w-3" />
          <span>
            {community.reviewerCount} reviewers, {community.themeCount} themes
          </span>
        </button>
      )}

      {/* User status */}
      {userStatus && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="h-3 w-3" />
          {userStatus}
        </span>
      )}

      {/* Deadline */}
      {deadline && (
        <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
          <Clock className="h-3 w-3" />
          {deadline}
        </span>
      )}
    </div>
  );
}
