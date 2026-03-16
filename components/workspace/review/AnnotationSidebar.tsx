'use client';

import { useState, useCallback } from 'react';
import {
  MessageSquare,
  Highlighter,
  AlertTriangle,
  BookOpen,
  Globe,
  Lock,
  Trash2,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { ProposalAnnotation, AnnotationType } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<AnnotationType, { bg: string; text: string }> = {
  note: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-200' },
  highlight: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
  citation: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200' },
  concern: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200' },
};

const TYPE_ICONS: Record<AnnotationType, typeof MessageSquare> = {
  note: MessageSquare,
  highlight: Highlighter,
  citation: BookOpen,
  concern: AlertTriangle,
};

const TYPE_LABELS: Record<AnnotationType, string> = {
  note: 'Note',
  highlight: 'Highlight',
  citation: 'Citation',
  concern: 'Concern',
};

const FIELD_LABELS: Record<string, string> = {
  abstract: 'Abstract',
  motivation: 'Motivation',
  rationale: 'Rationale',
};

type FilterTab = 'all' | 'mine' | 'public' | 'concerns';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnnotationSidebarProps {
  proposalTxHash: string;
  proposalIndex: number;
  annotations: ProposalAnnotation[];
  currentUserId?: string;
  onUpdateAnnotation: (
    id: string,
    updates: Partial<Pick<ProposalAnnotation, 'annotationText' | 'isPublic' | 'color'>>,
  ) => void;
  onDeleteAnnotation: (id: string) => void;
  onScrollToAnnotation: (annotationId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnotationSidebar({
  annotations,
  currentUserId,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onScrollToAnnotation,
}: AnnotationSidebarProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filteredAnnotations = annotations.filter((a) => {
    switch (activeTab) {
      case 'mine':
        return a.userId === currentUserId;
      case 'public':
        return a.isPublic;
      case 'concerns':
        return a.annotationType === 'concern';
      default:
        return true;
    }
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: annotations.length },
    {
      key: 'mine',
      label: 'My Notes',
      count: annotations.filter((a) => a.userId === currentUserId).length,
    },
    {
      key: 'public',
      label: 'Public',
      count: annotations.filter((a) => a.isPublic).length,
    },
    {
      key: 'concerns',
      label: 'Concerns',
      count: annotations.filter((a) => a.annotationType === 'concern').length,
    },
  ];

  const handleScrollTo = useCallback(
    (annotationId: string) => {
      onScrollToAnnotation(annotationId);
      // Also try to scroll the element into view directly
      const el = document.querySelector(`[data-annotation-id="${annotationId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Briefly flash the highlight
        el.classList.add('ring-2', 'ring-primary');
        setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
      }
    },
    [onScrollToAnnotation],
  );

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Annotations
          <span className="ml-auto tabular-nums text-[10px]">{annotations.length}</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 tabular-nums text-[10px] opacity-70">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Annotation List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {filteredAnnotations.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {activeTab === 'all'
                ? 'No annotations yet. Select text to add one.'
                : `No ${activeTab === 'mine' ? 'personal' : activeTab} annotations.`}
            </p>
          )}

          {filteredAnnotations.map((a) => (
            <AnnotationCard
              key={a.id}
              annotation={a}
              isOwn={a.userId === currentUserId}
              onScrollTo={() => handleScrollTo(a.id)}
              onTogglePublic={() => onUpdateAnnotation(a.id, { isPublic: !a.isPublic })}
              onDelete={() => onDeleteAnnotation(a.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AnnotationCard
// ---------------------------------------------------------------------------

function AnnotationCard({
  annotation,
  isOwn,
  onScrollTo,
  onTogglePublic,
  onDelete,
}: {
  annotation: ProposalAnnotation;
  isOwn: boolean;
  onScrollTo: () => void;
  onTogglePublic: () => void;
  onDelete: () => void;
}) {
  const colors = TYPE_COLORS[annotation.annotationType];
  const Icon = TYPE_ICONS[annotation.annotationType];

  return (
    <div
      className="group rounded-lg border border-border p-2.5 space-y-1.5 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onScrollTo}
    >
      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            colors.bg,
            colors.text,
          )}
        >
          <Icon className="h-3 w-3" />
          {TYPE_LABELS[annotation.annotationType]}
        </span>
        <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {FIELD_LABELS[annotation.anchorField] ?? annotation.anchorField}
        </span>
        {annotation.isPublic && <Globe className="h-3 w-3 text-primary/60" />}
      </div>

      {/* Annotation text */}
      <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">
        {annotation.annotationText}
      </p>

      {/* Timestamp + actions */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {new Date(annotation.createdAt).toLocaleDateString()}
        </span>
        {isOwn && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePublic();
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
              title={annotation.isPublic ? 'Make private' : 'Publish'}
            >
              {annotation.isPublic ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
