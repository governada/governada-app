'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { staggerContainer, staggerContainerSlow, fadeInUp } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface StaggeredListProps {
  children: React.ReactNode;
  speed?: 'fast' | 'normal';
  className?: string;
  as?: 'div' | 'ul' | 'ol';
}

export function StaggeredList({
  children,
  speed = 'fast',
  className,
  as = 'div',
}: StaggeredListProps) {
  const prefersReducedMotion = useReducedMotion();

  // If reduced motion, render children directly without animation wrappers
  if (prefersReducedMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const containerVariants = speed === 'fast' ? staggerContainer : staggerContainerSlow;
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={cn(className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return <motion.div variants={fadeInUp}>{child}</motion.div>;
      })}
    </MotionTag>
  );
}
