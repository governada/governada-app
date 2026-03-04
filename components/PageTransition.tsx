'use client';

import { motion } from 'framer-motion';
import { useNavDirection } from '@/components/NavDirectionProvider';
import { pageTransitionVariants, getPageTransition, getPageInitial } from '@/lib/animations';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const direction = useNavDirection();

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial={getPageInitial(direction)}
      animate="center"
      transition={getPageTransition(direction)}
    >
      {children}
    </motion.div>
  );
}
