import Link from 'next/link';
import { TrendingUp, BookOpen } from 'lucide-react';

export function HealthQuickNav() {
  return (
    <div className="flex gap-3">
      <Link
        href="/governance/health/tracker"
        className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        <TrendingUp className="h-3.5 w-3.5" />
        North Star Tracker
      </Link>
      <Link
        href="/governance/health/methodology"
        className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Methodology
      </Link>
    </div>
  );
}
