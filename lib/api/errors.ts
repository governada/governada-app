/**
 * API Error Code Registry
 * Every public API error has a stable code, human message, actionable hint, and docs link.
 */

const DOCS_BASE = 'https://drepscore.io/developers/errors';

export interface ApiErrorDef {
  code: string;
  status: number;
  message: string;
  hint: string;
}

type ErrorParams = Record<string, string | number>;

function interpolate(template: string, params: ErrorParams): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

const ERROR_REGISTRY: Record<string, Omit<ApiErrorDef, 'code'>> = {
  // Auth (401)
  missing_api_key: {
    status: 401,
    message: 'No API key provided. Anonymous requests are limited to 10/hr.',
    hint: "Include header 'X-API-Key: ds_live_...' for higher rate limits.",
  },
  invalid_api_key: {
    status: 401,
    message: 'The API key provided is not valid.',
    hint: 'Check that the key is correct and has not been revoked.',
  },
  revoked_api_key: {
    status: 401,
    message: 'This API key has been revoked.',
    hint: 'Generate a new key at drepscore.io/developers.',
  },

  // Rate limiting (429)
  rate_limit_exceeded: {
    status: 429,
    message:
      'Rate limit exceeded. {used} requests used of {limit} per {window}. Resets at {reset_time}.',
    hint: 'Upgrade your API tier for higher limits, or add caching on your side.',
  },

  // Validation (400)
  invalid_drep_id: {
    status: 400,
    message: "The DRep ID '{value}' is not a valid format.",
    hint: "Expected bech32 'drep1...' or 56-character hex hash.",
  },
  invalid_proposal_id: {
    status: 400,
    message: "The proposal ID '{value}' is not valid.",
    hint: "Use format '{tx_hash}-{index}' or the full transaction hash.",
  },
  invalid_parameter: {
    status: 400,
    message: "Parameter '{param}' has invalid value '{value}'.",
    hint: '{context}',
  },
  missing_parameter: {
    status: 400,
    message: "Required parameter '{param}' is missing.",
    hint: '{context}',
  },

  // Resource (404)
  drep_not_found: {
    status: 404,
    message: "No DRep found with ID '{value}'.",
    hint: 'Verify the ID is correct. The DRep may not be registered or may have retired.',
  },
  proposal_not_found: {
    status: 404,
    message: "No proposal found with ID '{value}'.",
    hint: 'The proposal may not have been synced yet. Data syncs every 30 minutes.',
  },

  // Access (403)
  tier_insufficient: {
    status: 403,
    message:
      "This endpoint requires '{required_tier}' tier or above. Your key is '{current_tier}'.",
    hint: 'Upgrade at drepscore.io/developers/upgrade.',
  },

  // Server (500)
  internal_error: {
    status: 500,
    message: 'An unexpected error occurred. Request ID: {request_id}.',
    hint: 'If this persists, contact support with the request ID.',
  },
  upstream_timeout: {
    status: 502,
    message: 'The data source is temporarily unavailable.',
    hint: 'Retry after a few seconds. Our data is cached, so this is rare.',
  },
  service_degraded: {
    status: 503,
    message: 'The API is experiencing degraded performance.',
    hint: 'Responses may be slower than usual. Data accuracy is not affected.',
  },
};

export function getApiError(
  code: string,
  params: ErrorParams = {},
): ApiErrorDef & { docs: string } {
  const template = ERROR_REGISTRY[code];
  if (!template) {
    return {
      code: 'internal_error',
      status: 500,
      message: `Unknown error code: ${code}`,
      hint: 'This is a bug. Please report it.',
      docs: `${DOCS_BASE}#internal_error`,
    };
  }

  return {
    code,
    status: template.status,
    message: interpolate(template.message, params),
    hint: interpolate(template.hint, params),
    docs: `${DOCS_BASE}#${code}`,
  };
}

export function isValidErrorCode(code: string): boolean {
  return code in ERROR_REGISTRY;
}
