'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/utils/wallet';
import { useDelegation } from '@/hooks/useDelegation';
import {
  checkGovernanceSupport,
  preflightDelegation,
  type DelegationPreflight,
  type GovernanceCheck,
} from '@/lib/delegation';
import { BrowserWallet, resolveRewardAddress } from '@meshsdk/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

function getCardanoObject(): Record<string, Record<string, unknown>> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as Record<string, Record<string, Record<string, unknown>>>).cardano;
}

export function DelegationTestClient() {
  const {
    wallet,
    walletName,
    connected,
    connecting,
    address,
    delegatedDrepId,
    availableWallets,
    connect,
    disconnect,
  } = useWallet();

  const { phase, startDelegation, confirmDelegation, reset, isProcessing } = useDelegation();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [drepIdInput, setDrepIdInput] = useState('');
  const [walletDetails, setWalletDetails] = useState<Record<string, unknown>>({});
  const [govCheck, setGovCheck] = useState<GovernanceCheck | null>(null);
  const [preflight, setPreflight] = useState<DelegationPreflight | null>(null);
  const [rewardAddress, setRewardAddress] = useState<string | null>(null);

  const log = (level: LogEntry['level'], message: string, data?: unknown) => {
    setLogs((prev) => [
      {
        time: new Date().toISOString().slice(11, 23),
        level,
        message,
        data,
      },
      ...prev,
    ]);
  };

  // Detect installed wallets
  useEffect(() => {
    const cardano = getCardanoObject();
    if (!cardano) {
      log('warn', 'window.cardano not found');
      return;
    }

    const installed = BrowserWallet.getInstalledWallets();
    log(
      'info',
      `Detected ${installed.length} wallets`,
      installed.map((w) => ({
        name: w.name,
        icon: w.icon ? 'present' : 'missing',
      })),
    );

    const details: Record<string, unknown> = {};
    for (const w of installed) {
      const api = cardano[w.name.toLowerCase()];
      details[w.name] = {
        apiVersion: api?.apiVersion,
        supportedExtensions: api?.supportedExtensions,
        name: api?.name,
      };
    }
    setWalletDetails(details);
  }, []);

  // Resolve reward address when connected
  useEffect(() => {
    if (!address) {
      setRewardAddress(null);
      return;
    }
    try {
      const stake = resolveRewardAddress(address);
      setRewardAddress(stake || null);
      log('info', 'Resolved reward address', { rewardAddress: stake });
    } catch (err) {
      log('error', 'Failed to resolve reward address', err);
    }
  }, [address]);

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

  const handlePreflight = async () => {
    if (!wallet) return;
    log('info', 'Running preflight...');
    try {
      const result = await preflightDelegation(wallet);
      setPreflight(result);
      log('success', 'Preflight passed', result);
    } catch (err) {
      log(
        'error',
        'Preflight failed',
        err instanceof Error
          ? {
              code: (err as unknown as { code?: string }).code,
              message: err.message,
              hint: (err as unknown as { hint?: string }).hint,
            }
          : err,
      );
    }
  };

  const handleStartDelegation = async () => {
    if (!drepIdInput.trim()) {
      log('warn', 'Enter a DRep ID first');
      return;
    }
    log('info', `Starting delegation to ${drepIdInput}...`);
    await startDelegation(drepIdInput.trim());
  };

  const handleConfirm = async () => {
    if (!drepIdInput.trim()) return;
    log('info', 'Confirming delegation...');
    const result = await confirmDelegation(drepIdInput.trim());
    if (result) {
      log('success', 'Delegation submitted!', result);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setGovCheck(null);
    setPreflight(null);
    setRewardAddress(null);
    log('info', 'Disconnected');
  };

  const handleReset = () => {
    reset();
    setPreflight(null);
    log('info', 'Delegation state reset');
  };

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Delegation Test Harness</h1>
      <p className="text-sm text-muted-foreground">
        Step-by-step delegation testing for wallet compatibility verification.
      </p>

      {/* Status bar */}
      <div className="flex flex-wrap gap-2">
        <StatusBadge ok={connected} label="Connected" />
        <StatusBadge ok={govCheck?.supported ?? null} label="CIP-95" />
        <StatusBadge ok={preflight ? true : null} label="Preflight" />
        <StatusBadge ok={rewardAddress?.startsWith('stake1') ?? null} label="Mainnet" />
        <StatusBadge ok={preflight?.stakeRegistered ?? null} label="Stake Reg" />
        {walletName && <Badge variant="outline">{walletName}</Badge>}
        {delegatedDrepId && (
          <Badge variant="outline">Delegated: {delegatedDrepId.slice(0, 16)}...</Badge>
        )}
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
              {rewardAddress && (
                <p className="text-xs font-mono text-muted-foreground">Stake: {rewardAddress}</p>
              )}
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          )}

          {Object.keys(walletDetails).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Wallet API details</summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(walletDetails, null, 2)}
              </pre>
            </details>
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

      {/* Step 3: Preflight */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 3: Preflight Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" disabled={!connected} onClick={handlePreflight}>
            Run Preflight
          </Button>
          {preflight && (
            <div className="text-sm p-2 bg-muted rounded space-y-1">
              <p>
                Reward Address: <span className="font-mono text-xs">{preflight.rewardAddress}</span>
              </p>
              <p>
                Stake Registered:{' '}
                <span className="font-medium">{String(preflight.stakeRegistered)}</span>
              </p>
              <p>
                Estimated Fee: <span className="font-medium">{preflight.estimatedFee}</span>
              </p>
              <p>
                Needs Deposit: <span className="font-medium">{String(preflight.needsDeposit)}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Delegate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 4: Delegate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            value={drepIdInput}
            onChange={(e) => setDrepIdInput(e.target.value)}
            placeholder="drep1... or DRep hash"
            className="w-full p-2 text-sm border rounded bg-background font-mono"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!connected || isProcessing} onClick={handleStartDelegation}>
              Start Delegation
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
                Fee: {phase.preflight.estimatedFee}, Deposit: {String(phase.preflight.needsDeposit)}
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
