'use client';

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { useVote } from '@/hooks/useVote';
import { checkGovernanceSupport } from '@/lib/delegation';
import { BrowserWallet } from '@meshsdk/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { VoteChoice } from '@/lib/voting';

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: unknown;
}

function StatusBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <Badge variant="secondary">{label}: pending</Badge>;
  return ok ? (
    <Badge variant="default" className="bg-green-600">
      {label}: OK
    </Badge>
  ) : (
    <Badge variant="destructive">{label}: FAIL</Badge>
  );
}

export function VoteTestClient() {
  const {
    wallet,
    walletName,
    connected,
    connecting,
    address,
    ownDRepId,
    availableWallets,
    connect,
    disconnect,
  } = useWallet();

  const { phase, startVote, confirmVote, reset, isProcessing } = useVote();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [txHashInput, setTxHashInput] = useState('');
  const [txIndexInput, setTxIndexInput] = useState('0');
  const [selectedVote, setSelectedVote] = useState<VoteChoice>('Yes');
  const [govCheck, setGovCheck] = useState<{ supported: boolean; hint?: string } | null>(null);

  const log = (level: LogEntry['level'], message: string, data?: unknown) => {
    setLogs((prev) => [
      { time: new Date().toISOString().slice(11, 23), level, message, data },
      ...prev,
    ]);
  };

  const handleConnect = async (name: string) => {
    log('info', `Connecting to ${name}...`);
    await connect(name);
    log('success', `Connected to ${name}`);
  };

  const handleGovCheck = () => {
    if (!walletName) return;
    const result = checkGovernanceSupport(walletName);
    setGovCheck(result);
    log(
      result.supported ? 'success' : 'warn',
      `Governance check: ${result.supported ? 'supported' : 'unsupported'}`,
      result,
    );
  };

  const handleStartVote = async () => {
    if (!txHashInput.trim()) {
      log('warn', 'Enter a governance action tx hash first');
      return;
    }
    const txIndex = parseInt(txIndexInput, 10) || 0;
    log('info', `Starting vote on ${txHashInput}#${txIndex}...`);
    await startVote({ txHash: txHashInput.trim(), txIndex, title: 'Test vote' }, 'drep');
  };

  const handleConfirm = async () => {
    log('info', `Confirming ${selectedVote} vote...`);
    const result = await confirmVote(selectedVote);
    if (result) {
      log('success', 'Vote submitted!', result);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setGovCheck(null);
    log('info', 'Disconnected');
  };

  const handleReset = () => {
    reset();
    log('info', 'Vote state reset');
  };

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Vote Casting Test Harness</h1>
      <p className="text-sm text-muted-foreground">
        Step-by-step governance vote testing for DRep wallet verification.
      </p>

      {/* Status bar */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge ok={connected} label="Connected" />
        <StatusBadge ok={govCheck?.supported ?? null} label="CIP-95" />
        <StatusBadge ok={!!ownDRepId} label="DRep" />
        {walletName && <Badge variant="outline">{walletName}</Badge>}
        {ownDRepId && <Badge variant="outline">DRep: {ownDRepId.slice(0, 16)}...</Badge>}
      </div>

      {/* Step 1: Connect */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1: Connect Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!connected ? (
            <div className="flex flex-wrap gap-2">
              {availableWallets.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleConnect(name)}
                  disabled={connecting}
                >
                  {name}
                </Button>
              ))}
              {availableWallets.length === 0 && (
                <p className="text-sm text-muted-foreground">No wallets detected</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-mono">{address}</p>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Governance check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2: Governance Capability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" disabled={!connected} onClick={handleGovCheck}>
            Check CIP-95 Support
          </Button>
          {govCheck && (
            <div
              className={`text-sm p-2 rounded ${govCheck.supported ? 'bg-green-500/10' : 'bg-amber-500/10'}`}
            >
              {govCheck.supported ? 'Governance supported' : govCheck.hint}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Cast Vote */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 3: Cast Vote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="vote-tx-hash" className="text-xs text-muted-foreground">
                Gov Action Tx Hash
              </label>
              <input
                id="vote-tx-hash"
                type="text"
                value={txHashInput}
                onChange={(e) => setTxHashInput(e.target.value)}
                placeholder="abc123..."
                className="w-full p-2 text-sm border rounded bg-background font-mono"
              />
            </div>
            <div>
              <label htmlFor="vote-tx-index" className="text-xs text-muted-foreground">
                Index
              </label>
              <input
                id="vote-tx-index"
                type="number"
                value={txIndexInput}
                onChange={(e) => setTxIndexInput(e.target.value)}
                placeholder="0"
                className="w-full p-2 text-sm border rounded bg-background font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {(['Yes', 'No', 'Abstain'] as VoteChoice[]).map((v) => (
              <Button
                key={v}
                variant={selectedVote === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedVote(v)}
              >
                {v}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" disabled={!connected || isProcessing} onClick={handleStartVote}>
              Start Vote
            </Button>
            {phase.status === 'confirming' && (
              <Button size="sm" onClick={handleConfirm}>
                Confirm &amp; Sign
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </div>

          <div className="text-sm p-2 bg-muted rounded">
            Phase: <span className="font-medium">{phase.status}</span>
            {phase.status === 'success' && (
              <span className="ml-2 font-mono text-xs text-green-600">tx: {phase.txHash}</span>
            )}
            {phase.status === 'error' && (
              <span className="ml-2 text-destructive text-xs">{phase.hint}</span>
            )}
            {phase.status === 'confirming' && (
              <span className="ml-2 text-xs">
                Fee: {phase.preflight.estimatedFee}, Existing vote:{' '}
                {String(phase.preflight.hasExistingVote)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log output */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Log
            <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
              Clear
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-auto space-y-1 text-xs font-mono">
            {logs.map((entry, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  entry.level === 'error'
                    ? 'text-red-500'
                    : entry.level === 'warn'
                      ? 'text-amber-500'
                      : entry.level === 'success'
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                }`}
              >
                <span className="flex-shrink-0 opacity-60">{entry.time}</span>
                <span>{entry.message}</span>
                {entry.data !== undefined && (
                  <span className="opacity-60 truncate">{String(JSON.stringify(entry.data))}</span>
                )}
              </div>
            ))}
            {logs.length === 0 && <p className="text-muted-foreground">No log entries yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
