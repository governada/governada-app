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
});
