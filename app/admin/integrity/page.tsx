'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { IntegrityDashboard } from '@/components/admin/IntegrityDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';

export default function AdminIntegrityPage() {
  const { address, sessionAddress } = useWallet();
  const adminAddress = sessionAddress || address;
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!adminAddress) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: adminAddress }),
    })
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.isAdmin === true))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, [adminAddress]);

  if (checking) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Checking access...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <Card>
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <IntegrityDashboard adminAddress={adminAddress!} />
    </div>
  );
}
