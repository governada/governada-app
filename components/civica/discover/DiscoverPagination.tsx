'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DiscoverPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function DiscoverPagination({ page, totalPages, onPageChange }: DiscoverPaginationProps) {
  if (totalPages <= 1) return null;

  // Build page numbers: always show first, last, and up to 5 around current
  const pages: (number | 'ellipsis')[] = [];
  const range = 2;
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || (i >= page - range && i <= page + range)) {
      pages.push(i);
    } else if (pages.length > 0 && pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>
      <div className="flex gap-1">
        {pages.map((pg, idx) =>
          pg === 'ellipsis' ? (
            <span
              key={`e-${idx}`}
              className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground"
            >
              ...
            </span>
          ) : (
            <button
              key={pg}
              onClick={() => onPageChange(pg)}
              className={cn(
                'h-7 w-7 text-xs rounded-md border transition-colors',
                pg === page
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {pg + 1}
            </button>
          ),
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
