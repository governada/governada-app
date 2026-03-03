'use client';

import { motion } from 'framer-motion';
import { spring } from '@/lib/animations';

interface NarrativeSummaryProps {
  text: string | null;
  accentColor?: string;
  className?: string;
}

export function NarrativeSummary({ text, accentColor, className = '' }: NarrativeSummaryProps) {
  if (!text) return null;

  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className={`text-sm text-muted-foreground leading-relaxed ${className}`}
      style={
        accentColor
          ? {
              borderLeft: `2px solid ${accentColor}`,
              paddingLeft: '0.75rem',
            }
          : undefined
      }
    >
      {text}
    </motion.p>
  );
}
