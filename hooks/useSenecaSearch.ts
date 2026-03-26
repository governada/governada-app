'use client';

/**
 * useSenecaSearch — Client hook for semantic search via the Seneca Thread.
 *
 * Calls /api/intelligence/search which embeds the query and does pgvector
 * similarity search. Works for both anonymous and authenticated users.
 * Cost: ~$0.00004 per query (OpenAI embedding only, no LLM call).
 */

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  entityType: 'proposal' | 'drep_profile';
  entityId: string;
  similarity: number;
  title: string;
  subtitle?: string;
  status?: string;
  href: string;
  meta?: Record<string, unknown>;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  hasSearched: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSenecaSearch() {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    isSearching: false,
    error: null,
    hasSearched: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string, entityType: string = 'all') => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setState((prev) => ({
        ...prev,
        query: trimmed,
        results: [],
        isSearching: false,
        error: null,
        hasSearched: false,
      }));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({
      ...prev,
      query: trimmed,
      isSearching: true,
      error: null,
    }));

    try {
      const params = new URLSearchParams({
        q: trimmed,
        type: entityType,
        limit: '8',
      });

      const res = await fetch(`/api/intelligence/search?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Search failed (${res.status})`);
      }

      const data = await res.json();

      setState((prev) => ({
        ...prev,
        results: data.results ?? [],
        isSearching: false,
        hasSearched: true,
      }));
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      setState((prev) => ({
        ...prev,
        results: [],
        isSearching: false,
        error: err instanceof Error ? err.message : 'Search failed',
        hasSearched: true,
      }));
    }
  }, []);

  const clearSearch = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setState({
      query: '',
      results: [],
      isSearching: false,
      error: null,
      hasSearched: false,
    });
  }, []);

  return {
    ...state,
    search,
    clearSearch,
  };
}
