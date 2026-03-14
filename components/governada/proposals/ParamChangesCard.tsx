'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

/** Human-readable labels for Cardano protocol parameters */
const PARAM_LABELS: Record<string, { label: string; unit?: string; description: string }> = {
  min_fee_a: {
    label: 'Min Fee Coefficient',
    unit: 'lovelace/byte',
    description: 'Linear fee coefficient',
  },
  min_fee_b: {
    label: 'Min Fee Constant',
    unit: 'lovelace',
    description: 'Fixed fee per transaction',
  },
  max_block_size: {
    label: 'Max Block Size',
    unit: 'bytes',
    description: 'Maximum block body size',
  },
  max_tx_size: {
    label: 'Max Transaction Size',
    unit: 'bytes',
    description: 'Maximum transaction size',
  },
  max_block_header_size: {
    label: 'Max Block Header Size',
    unit: 'bytes',
    description: 'Maximum block header size',
  },
  key_deposit: {
    label: 'Key Deposit',
    unit: 'lovelace',
    description: 'Stake key registration deposit',
  },
  pool_deposit: {
    label: 'Pool Deposit',
    unit: 'lovelace',
    description: 'Pool registration deposit',
  },
  e_max: { label: 'Max Epoch', description: 'Maximum epoch for pool retirement' },
  n_opt: { label: 'Desired Pool Count', description: 'Target number of stake pools (k parameter)' },
  a0: { label: 'Pool Influence', description: 'Pool owner pledge influence factor' },
  rho: {
    label: 'Monetary Expansion',
    description: 'Fraction of reserves moved to treasury each epoch',
  },
  tau: { label: 'Treasury Cut', description: 'Fraction of rewards going to treasury' },
  min_pool_cost: {
    label: 'Min Pool Cost',
    unit: 'lovelace',
    description: 'Minimum fixed cost for pools',
  },
  cost_model_id: { label: 'Cost Model', description: 'Plutus cost model reference ID' },
  price_mem: {
    label: 'Memory Price',
    unit: 'lovelace/unit',
    description: 'Price per unit of Plutus memory',
  },
  price_step: {
    label: 'Step Price',
    unit: 'lovelace/unit',
    description: 'Price per Plutus execution step',
  },
  max_tx_ex_mem: {
    label: 'Max Tx Execution Memory',
    unit: 'units',
    description: 'Maximum Plutus memory per transaction',
  },
  max_tx_ex_steps: {
    label: 'Max Tx Execution Steps',
    unit: 'steps',
    description: 'Maximum Plutus steps per transaction',
  },
  max_block_ex_mem: {
    label: 'Max Block Execution Memory',
    unit: 'units',
    description: 'Maximum Plutus memory per block',
  },
  max_block_ex_steps: {
    label: 'Max Block Execution Steps',
    unit: 'steps',
    description: 'Maximum Plutus steps per block',
  },
  max_val_size: {
    label: 'Max Value Size',
    unit: 'bytes',
    description: 'Maximum serialized output value size',
  },
  collateral_percent: {
    label: 'Collateral Percent',
    unit: '%',
    description: 'Collateral percentage for Plutus scripts',
  },
  max_collateral_inputs: {
    label: 'Max Collateral Inputs',
    description: 'Maximum collateral inputs per transaction',
  },
  coins_per_utxo_size: {
    label: 'Coins Per UTxO Byte',
    unit: 'lovelace',
    description: 'Min ADA per UTxO byte',
  },
  drep_deposit: {
    label: 'DRep Deposit',
    unit: 'lovelace',
    description: 'DRep registration deposit',
  },
  drep_activity: {
    label: 'DRep Activity',
    unit: 'epochs',
    description: 'Epochs of inactivity before DRep is considered inactive',
  },
  committee_min_size: {
    label: 'Committee Min Size',
    description: 'Minimum Constitutional Committee size',
  },
  committee_max_term_length: {
    label: 'Committee Max Term',
    unit: 'epochs',
    description: 'Maximum term length for CC members',
  },
  gov_action_lifetime: {
    label: 'Gov Action Lifetime',
    unit: 'epochs',
    description: 'How long a governance action stays open',
  },
  gov_action_deposit: {
    label: 'Gov Action Deposit',
    unit: 'lovelace',
    description: 'Deposit to submit a governance action',
  },
  dvt_motion_no_confidence: {
    label: 'Threshold: No Confidence',
    unit: '%',
    description: 'DRep voting threshold for no confidence',
  },
  dvt_committee_normal: {
    label: 'Threshold: Committee Normal',
    unit: '%',
    description: 'DRep threshold for normal committee updates',
  },
  dvt_committee_no_confidence: {
    label: 'Threshold: Committee (No Confidence)',
    unit: '%',
    description: 'DRep threshold for committee updates during no confidence',
  },
  dvt_update_to_constitution: {
    label: 'Threshold: Constitution',
    unit: '%',
    description: 'DRep threshold for constitutional updates',
  },
  dvt_hard_fork_initiation: {
    label: 'Threshold: Hard Fork',
    unit: '%',
    description: 'DRep threshold for hard fork initiation',
  },
  dvt_p_p_network_group: {
    label: 'Threshold: Network Params',
    unit: '%',
    description: 'DRep threshold for network parameter changes',
  },
  dvt_p_p_economic_group: {
    label: 'Threshold: Economic Params',
    unit: '%',
    description: 'DRep threshold for economic parameter changes',
  },
  dvt_p_p_technical_group: {
    label: 'Threshold: Technical Params',
    unit: '%',
    description: 'DRep threshold for technical parameter changes',
  },
  dvt_p_p_gov_group: {
    label: 'Threshold: Gov Params',
    unit: '%',
    description: 'DRep threshold for governance parameter changes',
  },
  dvt_treasury_withdrawal: {
    label: 'Threshold: Treasury',
    unit: '%',
    description: 'DRep threshold for treasury withdrawals',
  },
};

function formatParamValue(key: string, value: unknown): string {
  if (value == null) return '—';
  const num = Number(value);
  if (isNaN(num)) return String(value);

  // Large lovelace values → ADA
  const info = PARAM_LABELS[key];
  if (info?.unit === 'lovelace' && num >= 1_000_000) {
    return `${(num / 1_000_000).toLocaleString()} ADA`;
  }

  // Large numbers get commas
  if (num >= 1_000) return num.toLocaleString();

  // Ratios / percentages
  if (info?.unit === '%' && num <= 1) return `${(num * 100).toFixed(1)}%`;

  return String(value);
}

interface ParamChangesCardProps {
  paramChanges: Record<string, unknown>;
}

export function ParamChangesCard({ paramChanges }: ParamChangesCardProps) {
  const entries = Object.entries(paramChanges);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4 text-blue-400" />
          Parameter Changes
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {entries.length} parameter{entries.length !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50 rounded-lg border overflow-hidden">
          {entries.map(([key, value]) => {
            const info = PARAM_LABELS[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{info?.label || key}</p>
                  <p className="text-[10px] text-muted-foreground">{info?.description || key}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-semibold tabular-nums text-primary">
                    {formatParamValue(key, value)}
                  </p>
                  {info?.unit && !info.unit.includes('%') && (
                    <p className="text-[10px] text-muted-foreground">{info.unit}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
