export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/csp-report
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * Logs them for monitoring — no action taken automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const report = body['csp-report'] || body;

    logger.warn('CSP violation', {
      context: 'csp-report',
      directive: report['violated-directive'] || report.effectiveDirective,
      blockedUri: report['blocked-uri'] || report.blockedURL,
      documentUri: report['document-uri'] || report.documentURL,
      sourceFile: report['source-file'] || report.sourceFile,
    });
  } catch {
    // Malformed report — ignore silently
  }

  return new NextResponse(null, { status: 204 });
}
