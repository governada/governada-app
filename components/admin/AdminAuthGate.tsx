'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

interface AdminAuthGateProps {
  children: ReactNode;
}

/**
 * Shared admin authentication gate.
 * Checks wallet against ADMIN_WALLETS via /api/admin/check.
 * Renders children only if admin, otherwise shows access denied.
 */
export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const { isAuthenticated, address, sessionAddress } = useWallet();
  const adminAddress = sessionAddress || address;
  const [state, setState] = useState<'checking' | 'admin' | 'denied'>('checking');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const token = getStoredSession();
    if (!token) {
      setState('denied');
      return;
    }

    setState('checking');
    fetch('/api/admin/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) {
          setState(data?.isAdmin === true ? 'admin' : 'denied');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') {
          setState('denied');
        }
      });

    return () => controller.abort();
  }, [isAuthenticated, adminAddress]);

  if (state === 'checking') {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Checking access...</span>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <Card className="max-w-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">
              {adminAddress
                ? 'This wallet is not authorized to access the admin dashboard.'
                : 'Connect an admin wallet to access this page.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
