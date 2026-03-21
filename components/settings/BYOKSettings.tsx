'use client';

/**
 * BYOKSettings — manage personal AI API keys in the settings page.
 *
 * Shows stored keys (masked), allows adding/testing/removing keys.
 * Gated behind the "byok_api_keys" feature flag.
 */

import { useState } from 'react';
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  X,
  ShieldCheck,
} from 'lucide-react';
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
// Provider metadata for user education
// ---------------------------------------------------------------------------

const PROVIDER_INFO: Record<string, { label: string; keyUrl: string; placeholder: string }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'Paste your Anthropic key here',
  },
  openai: {
    label: 'OpenAI (GPT)',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'Paste your OpenAI key here',
  },
};

// ---------------------------------------------------------------------------
// Add Key Form
// ---------------------------------------------------------------------------

function AddKeyForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [provider, setProvider] = useState<string>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const addMutation = useAddBYOKKey();

  const providerMeta = PROVIDER_INFO[provider] ?? PROVIDER_INFO.anthropic;

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
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-4">
      {/* Step 1: Choose provider */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">1. Choose your provider</label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="anthropic">{PROVIDER_INFO.anthropic.label}</SelectItem>
            <SelectItem value="openai">{PROVIDER_INFO.openai.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: Get and paste key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">2. Paste your API key</label>
          <a
            href={providerMeta.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            Get a key
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder={providerMeta.placeholder}
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

      {/* Privacy note */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
        <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0" />
        <span>Your key is encrypted and stored securely. It never leaves our server.</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
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
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

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

  const providerMeta = PROVIDER_INFO[provider];
  const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="secondary" className="shrink-0">
          {providerMeta?.label ?? provider}
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
                This will remove your {providerMeta?.label ?? provider} API key. AI features will
                fall back to the platform key. You can add a new key at any time.
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Your AI Provider</h3>
        </div>
        {showForm && (
          <button
            onClick={() => setShowForm(false)}
            className="p-1 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close form"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
              Governada&apos;s AI features work out of the box. Add your own API key if you&apos;d
              prefer to use your personal account with Anthropic or OpenAI.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Not sure what this means? You don&apos;t need it &mdash; skip this and everything
              works the same.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your own key
            </Button>
          </div>
        )}

        {!isLoading && showForm && !hasKeys && (
          <AddKeyForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
        )}

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
                  <AddKeyForm
                    onSuccess={() => setShowForm(false)}
                    onCancel={() => setShowForm(false)}
                  />
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
