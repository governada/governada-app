'use client';

import { motion } from 'framer-motion';
import { spring } from '@/lib/animations';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
    >
      {children}
    </motion.div>
  );
}
