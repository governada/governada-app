'use client';

import { createContext, useContext } from 'react';

interface DiscoveryHubContextValue {
  openHub: () => void;
  setCurrentPage: (page: string) => void;
}

const DiscoveryHubContext = createContext<DiscoveryHubContextValue | null>(null);

export function useDiscoveryHub() {
  return useContext(DiscoveryHubContext);
}

export { DiscoveryHubContext };
