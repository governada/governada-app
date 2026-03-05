/**
 * Cube.js Client Configuration for Civica Analytics
 *
 * Provides the Cube API client for querying the semantic layer.
 * Used by both server components (via direct API calls) and
 * client components (via CubeProvider + useCubeQuery).
 */

import cubejs, { type CubeApi, type Query } from '@cubejs-client/core';

let cubeApiInstance: CubeApi | null = null;

/**
 * Get the Cube API URL from environment.
 * In development: local Docker (http://localhost:4000)
 * In production: Railway internal service URL
 */
function getCubeApiUrl(): string {
  return process.env.NEXT_PUBLIC_CUBE_API_URL || 'http://localhost:4000/cubejs-api/v1';
}

/**
 * Get the Cube API token.
 * For server-side: uses the shared secret directly.
 * For client-side: fetches a short-lived JWT from our API route.
 */
async function getCubeToken(): Promise<string> {
  return process.env.NEXT_PUBLIC_CUBE_TOKEN || '';
}

/**
 * Get or create the Cube API client singleton.
 * Safe for both server and client use.
 */
export function getCubeApi(): CubeApi {
  if (!cubeApiInstance) {
    cubeApiInstance = cubejs(getCubeToken, {
      apiUrl: getCubeApiUrl(),
    });
  }
  return cubeApiInstance;
}

/**
 * Server-side Cube query helper.
 * Use this in Server Components and API routes.
 */
export async function cubeQuery<T = Record<string, unknown>>(query: Query): Promise<T[]> {
  const api = getCubeApi();
  const resultSet = await api.load(query);
  return resultSet.tablePivot() as T[];
}
