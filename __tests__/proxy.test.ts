import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy CORS headers', () => {
  it('allows Authorization for v1 API preflight requests', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/dreps', {
      method: 'OPTIONS',
    });

    const response = proxy(request);

    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-API-Key');
  });

  it('preserves protected-route intent for anonymous workspace requests', () => {
    const request = new NextRequest('http://localhost:3000/workspace/review?proposal=abc');

    const response = proxy(request);

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/?connect=1&returnTo=%2Fworkspace%2Freview%3Fproposal%3Dabc',
    );
  });

  it('preserves protected-route intent for anonymous identity requests', () => {
    const request = new NextRequest('http://localhost:3000/you');

    const response = proxy(request);

    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/?connect=1&returnTo=%2Fyou',
    );
  });
});
