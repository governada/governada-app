'use client';

/**
 * BYOKSettings — manage BYOK API keys in the settings page.
 *
 * Shows stored keys (masked), allows adding/testing/removing keys.
 * Gated behind the "byok_api_keys" feature flag.
 */

import { useState } from 'react';
import { Key, Plus, Trash2, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBYOKKeys, useAddBYOKKey, useDeleteBYOKKey, useTestBYOKKey } from '@/hooks/useBYOKKeys';

// ---------------------------------------------------------------------------
// Add Key Form
// ---------------------------------------------------------------------------

function AddKeyForm({ onSuccess }: { onSuccess: () => void }) {
  const [provider, setProvider] = useState<string>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const addMutation = useAddBYOKKey();

  const handleSubmit = () => {
    if (!apiKey.trim()) return;
    addMutation.mutate(
      { provider, apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          setApiKey('');
          setShowKey(false);
          onSuccess();
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!apiKey.trim() || addMutation.isPending}
        size="sm"
        className="gap-1.5"
      >
        {addMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Add key
      </Button>
      {addMutation.isError && (
        <p className="text-xs text-destructive">{addMutation.error.message}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stored Key Row
// ---------------------------------------------------------------------------

function StoredKeyRow({
  provider,
  keyPrefix,
  createdAt,
}: {
  provider: string;
  keyPrefix: string;
  createdAt: string;
}) {
  const deleteMutation = useDeleteBYOKKey();
  const testMutation = useTestBYOKKey();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="secondary" className="shrink-0 capitalize">
          {provider}
        </Badge>
        <span className="text-sm font-mono text-muted-foreground truncate">{keyPrefix}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{formattedDate}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Test button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => testMutation.mutate(provider)}
          disabled={testMutation.isPending}
          className="gap-1.5 text-xs"
        >
          {testMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : testMutation.isSuccess && testMutation.data.success ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : testMutation.isSuccess && !testMutation.data.success ? (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          ) : null}
          Test
        </Button>

        {/* Test result feedback */}
        {testMutation.isSuccess && !testMutation.data.success && (
          <span className="text-xs text-destructive max-w-[120px] truncate">
            {testMutation.data.error}
          </span>
        )}

        {/* Remove with confirmation */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove API Key</DialogTitle>
              <DialogDescription>
                This will remove your {provider} API key. AI features will fall back to the platform
                key. You can add a new key at any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate(provider, {
                    onSuccess: () => setConfirmOpen(false),
                  });
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : null}
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BYOKSettings() {
  const { data: keys, isLoading } = useBYOKKeys();
  const [showForm, setShowForm] = useState(false);

  const hasKeys = keys && keys.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
        <Key className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">AI API Keys (BYOK)</h3>
      </div>
      <div className="px-5 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16 hidden sm:block" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </div>
        )}

        {!isLoading && !hasKeys && !showForm && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bring your own AI. Your key, your model, your data stays private.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add API key
            </Button>
          </div>
        )}

        {!isLoading && showForm && !hasKeys && <AddKeyForm onSuccess={() => setShowForm(false)} />}

        {hasKeys && (
          <div className="space-y-3">
            {keys.map((k) => (
              <StoredKeyRow
                key={k.id}
                provider={k.provider}
                keyPrefix={k.keyPrefix}
                createdAt={k.createdAt}
              />
            ))}
            {/* Allow adding a second key for a different provider */}
            {keys.length < 2 && (
              <>
                {showForm ? (
                  <AddKeyForm onSuccess={() => setShowForm(false)} />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(true)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add another provider
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
