'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { spring } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import type { LucideIcon } from 'lucide-react';

export interface TabDefinition {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: ReactNode;
}

interface AnimatedTabsProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  /** When set, the tab bar becomes sticky at this offset from the top (px). */
  stickyOffset?: number;
  /** Additional properties sent with the drep_profile_tab_changed PostHog event. */
  trackingContext?: Record<string, string>;
  className?: string;
}

const SLIDE_DISTANCE = 60;

export function AnimatedTabs({
  tabs,
  defaultTab,
  stickyOffset,
  trackingContext,
  className,
}: AnimatedTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const prevIndexRef = useRef(tabs.findIndex((t) => t.id === activeTab));
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.slice(1);
    if (hash && tabs.some((t) => t.id === hash)) {
      setActiveTab(hash);
      prevIndexRef.current = tabs.findIndex((t) => t.id === hash);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (value: string) => {
    const newIndex = tabs.findIndex((t) => t.id === value);
    const oldIndex = prevIndexRef.current;
    setDirection(newIndex > oldIndex ? 1 : -1);
    prevIndexRef.current = newIndex;
    setActiveTab(value);
    posthog?.capture('drep_profile_tab_changed', { tab: value, ...trackingContext });

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${value}`);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className={cn('w-full', className)}>
      <TabsList
        variant="line"
        className={cn(
          'w-full justify-start gap-0 overflow-x-auto scrollbar-hide bg-transparent border-b border-border px-0',
          'snap-x snap-mandatory scroll-smooth',
          stickyOffset !== undefined && `sticky z-30 bg-background/95 backdrop-blur-sm`,
        )}
        style={stickyOffset !== undefined ? { top: `${stickyOffset}px` } : undefined}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="min-h-[44px] gap-1.5 px-4 snap-start data-[state=active]:text-foreground data-[state=active]:after:bg-primary"
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className={cn('mt-0 pt-6', activeTab !== tab.id && 'hidden')}
          forceMount
        >
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === tab.id && (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, x: direction * SLIDE_DISTANCE }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -SLIDE_DISTANCE }}
                transition={spring.smooth}
              >
                {tab.content}
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>
      ))}
    </Tabs>
  );
}
