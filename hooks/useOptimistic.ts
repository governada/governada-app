import { useState, useCallback, useRef } from 'react';

interface UseOptimisticOptions<T> {
  onMutate: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
}

interface UseOptimisticReturn<T> {
  execute: () => Promise<void>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useOptimistic<T = void>(options: UseOptimisticOptions<T>): UseOptimisticReturn<T> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      const result = await optionsRef.current.onMutate();
      optionsRef.current.onSuccess?.(result);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Mutation failed');
      setError(err);
      optionsRef.current.onError?.(err);
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { execute, isPending, error, reset };
}

export function useOptimisticToggle(opts: {
  currentValue: boolean;
  onToggle: (newValue: boolean) => Promise<void>;
  onError?: (error: Error) => void;
}) {
  const [optimisticValue, setOptimisticValue] = useState<boolean | null>(null);
  const [isPending, setIsPending] = useState(false);

  const displayValue = optimisticValue ?? opts.currentValue;

  const toggle = useCallback(async () => {
    const newValue = !displayValue;
    setOptimisticValue(newValue);
    setIsPending(true);
    try {
      await opts.onToggle(newValue);
    } catch (e) {
      setOptimisticValue(null);
      opts.onError?.(e instanceof Error ? e : new Error('Toggle failed'));
    } finally {
      setIsPending(false);
      setOptimisticValue(null);
    }
  }, [displayValue, opts]);

  return { value: displayValue, toggle, isPending };
}
