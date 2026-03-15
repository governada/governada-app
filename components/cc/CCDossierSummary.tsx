'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';

interface CCDossierSummaryProps {
  dossier: {
    executiveSummary: string;
    behavioralPatterns: string | null;
    constitutionalProfile: string | null;
  } | null;
}

export function CCDossierSummary({ dossier }: CCDossierSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  if (!dossier) return null;

  const hasFullAnalysis = dossier.behavioralPatterns || dossier.constitutionalProfile;

  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-xl border border-border/60 bg-card/30 px-4 py-4 space-y-3"
    >
      <p className="text-sm text-muted-foreground leading-relaxed">{dossier.executiveSummary}</p>

      {hasFullAnalysis && (
        <>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            {expanded ? 'Hide full analysis' : 'Full analysis'}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-2 border-t border-border/30">
                  {dossier.behavioralPatterns && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium">Behavioral Patterns</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {dossier.behavioralPatterns}
                      </p>
                    </div>
                  )}
                  {dossier.constitutionalProfile && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium">Constitutional Profile</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {dossier.constitutionalProfile}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        AI-generated
      </p>
    </motion.div>
  );
}
