import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Legal"
      className={cn('flex items-center justify-center gap-3 text-xs', className)}
    >
      <Link
        href="/privacy"
        className="text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        Privacy
      </Link>
      <span className="text-muted-foreground/40" aria-hidden="true">
        /
      </span>
      <Link
        href="/terms"
        className="text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        Terms
      </Link>
    </nav>
  );
}
