import { z } from 'zod';
import { logger } from './logger';

const requiredEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
        message:
          'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required; NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted temporarily for legacy compatibility',
      });
    }
  });

const optionalEnv = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  KOIOS_API_KEY: z.string().min(1).optional(),
  ADMIN_WALLETS: z.string().optional(),
  INNGEST_BASE_URL: z.string().url().optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SERVE_ORIGIN: z.string().url().optional(),
  INNGEST_SERVE_PATH: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
  SENTRY_ORG: z.string().min(1).optional(),
  SENTRY_PROJECT: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  HEARTBEAT_URL_PROPOSALS: z.string().url().optional(),
  HEARTBEAT_URL_BATCH: z.string().url().optional(),
  HEARTBEAT_URL_DAILY: z.string().url().optional(),
  HEARTBEAT_URL_SCORING: z.string().url().optional(),
  HEARTBEAT_URL_ALIGNMENT: z.string().url().optional(),
  HEARTBEAT_URL_FRESHNESS_GUARD: z.string().url().optional(),
  HEARTBEAT_URL_EPOCH_SUMMARY: z.string().url().optional(),
  ANALYTICS_DEPLOY_HOOK: z.string().url().optional(),
});

const OPTIONAL_KEYS = Object.keys(optionalEnv.shape) as (keyof z.infer<typeof optionalEnv>)[];
const OPTIONAL_IGNORED_KEYS = new Set<string>([
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'DISCORD_WEBHOOK_URL',
  'SLACK_WEBHOOK_URL',
  'HEARTBEAT_URL_PROPOSALS',
  'HEARTBEAT_URL_BATCH',
  'HEARTBEAT_URL_DAILY',
  'HEARTBEAT_URL_SCORING',
  'HEARTBEAT_URL_ALIGNMENT',
  'HEARTBEAT_URL_FRESHNESS_GUARD',
  'HEARTBEAT_URL_EPOCH_SUMMARY',
]);

const URL_SCHEMA = z.string().url();

interface OpsCriticalIssue {
  key: string;
  reason: string;
}

interface OpsCriticalGroupIssue {
  keys: string[];
  name: string;
  reason: string;
}

const OPS_CRITICAL_KEYS = [
  {
    key: 'NEXT_PUBLIC_SITE_URL',
    reason: 'canonical base URL for production links, callbacks, and notifications',
    schema: URL_SCHEMA,
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_DSN',
    reason: 'runtime Sentry capture for server and client observability',
    schema: URL_SCHEMA,
  },
  {
    key: 'HEARTBEAT_URL_PROPOSALS',
    reason: 'external heartbeat coverage for proposal-sync freshness',
    schema: URL_SCHEMA,
  },
  {
    key: 'HEARTBEAT_URL_BATCH',
    reason: 'external heartbeat coverage for batch syncs',
    schema: URL_SCHEMA,
  },
  {
    key: 'HEARTBEAT_URL_DAILY',
    reason: 'external heartbeat coverage for daily and epoch-critical jobs',
    schema: URL_SCHEMA,
  },
] as const;

const OPS_CRITICAL_GROUPS = [
  {
    keys: ['DISCORD_WEBHOOK_URL', 'SLACK_WEBHOOK_URL'] as const,
    name: 'alert_webhook',
    reason: 'operator alert delivery for integrity and inbox failures',
    schema: URL_SCHEMA,
  },
] as const;

export interface OpsEnvReport {
  invalid: OpsCriticalIssue[];
  missing: OpsCriticalIssue[];
  missingGroups: OpsCriticalGroupIssue[];
  status: 'healthy' | 'degraded';
}

function hasValidValue(key: string, schema: z.ZodType<string>): boolean {
  const value = process.env[key];
  return typeof value === 'string' && schema.safeParse(value).success;
}

export function getOpsEnvReport(): OpsEnvReport {
  const missing: OpsCriticalIssue[] = [];
  const invalid: OpsCriticalIssue[] = [];

  for (const item of OPS_CRITICAL_KEYS) {
    const value = process.env[item.key];
    if (!value) {
      missing.push({ key: item.key, reason: item.reason });
      continue;
    }

    if (!item.schema.safeParse(value).success) {
      invalid.push({ key: item.key, reason: item.reason });
    }
  }

  const missingGroups = OPS_CRITICAL_GROUPS.flatMap((group) => {
    const hasAnyValidKey = group.keys.some((key) => hasValidValue(key, group.schema));
    if (hasAnyValidKey) return [];

    return [
      {
        keys: [...group.keys],
        name: group.name,
        reason: group.reason,
      },
    ];
  });

  return {
    status: missing.length || invalid.length || missingGroups.length ? 'degraded' : 'healthy',
    missing,
    invalid,
    missingGroups,
  };
}

export function validateEnv(): void {
  const required = requiredEnv.safeParse(process.env);

  if (!required.success) {
    const missing = required.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Missing or invalid required environment variables:\n${missing.join('\n')}`);
  }

  const optional = optionalEnv.safeParse(process.env);
  if (!optional.success) {
    const invalid = optional.error.issues.map((issue) => ({
      key: issue.path.join('.'),
      message: issue.message,
    }));
    logger.error('Optional environment variables are invalid', {
      context: 'env-validation',
      invalid,
    });
  }

  const opsReport = getOpsEnvReport();
  if (opsReport.status === 'degraded') {
    logger.error('Ops-critical environment contract is degraded', {
      context: 'env-validation',
      invalid: opsReport.invalid,
      missing: opsReport.missing,
      missingGroups: opsReport.missingGroups,
    });
  }

  const missing: string[] = [];
  for (const key of OPTIONAL_KEYS) {
    if (OPTIONAL_IGNORED_KEYS.has(key)) {
      continue;
    }

    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.warn('Optional environment variables not set', {
      context: 'env-validation',
      missing,
    });
  }
}
