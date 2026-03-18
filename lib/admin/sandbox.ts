/**
 * Sandbox utilities — client-side helpers for admin sandbox mode.
 *
 * When an admin enters sandbox mode, writes are scoped to a preview cohort
 * so they can test the full authoring/review workflow without polluting
 * production data. The sandbox cohort ID is stored in sessionStorage and
 * attached to API requests via the `X-Sandbox-Cohort` header.
 */

/**
 * Get sandbox headers to include in fetch requests.
 * Returns empty object if not in sandbox mode.
 */
export function getSandboxHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const cohortId = sessionStorage.getItem('governada_sandbox');
    if (!cohortId) return {};
    return { 'X-Sandbox-Cohort': cohortId };
  } catch {
    return {};
  }
}

/**
 * Get combined admin headers (sandbox + impersonation) to include in fetch requests.
 * Returns empty object if neither mode is active.
 */
export function getAdminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {};
  try {
    const cohortId = sessionStorage.getItem('governada_sandbox');
    if (cohortId) headers['X-Sandbox-Cohort'] = cohortId;
    const impersonating = sessionStorage.getItem('governada_impersonate');
    if (impersonating) headers['X-Impersonating'] = 'true';
  } catch {
    /* sessionStorage unavailable */
  }
  return headers;
}

/** Storage key for sandbox cohort ID */
export const SANDBOX_STORAGE_KEY = 'governada_sandbox';

/** Marker prefix used in cohort description to identify admin sandboxes */
export const SANDBOX_DESCRIPTION_PREFIX = '[ADMIN_SANDBOX]';
