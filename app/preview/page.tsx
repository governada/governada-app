'use client';

export const dynamic = 'force-dynamic';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { saveSession } from '@/lib/supabaseAuth';

export default function PreviewPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }

      // Store session token for client-side auth (same key as wallet auth)
      if (data.sessionToken) {
        saveSession(data.sessionToken);
      }

      // Store preview metadata in sessionStorage
      sessionStorage.setItem(
        'governada_preview',
        JSON.stringify({
          previewSessionId: data.previewSessionId,
          cohortId: data.cohortId,
          personaPresetId: data.personaPresetId,
          personaSnapshot: data.personaSnapshot ?? {},
        }),
      );

      router.push('/governance');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Preview Access</CardTitle>
          <CardDescription>Enter your invite code to preview Governada</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              className="font-mono text-center text-lg tracking-widest"
              maxLength={12}
              autoFocus
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Enter Preview'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
