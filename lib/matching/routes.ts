export const HOMEPAGE_MATCH_MODE = 'match';
export const HOMEPAGE_MATCH_PATH = `/?mode=${HOMEPAGE_MATCH_MODE}`;

type RouteParamValue = string | string[] | undefined;
type RouteParamRecord = Record<string, RouteParamValue>;

export function isHomepageMatchMode(mode: string | null | undefined): boolean {
  return mode === HOMEPAGE_MATCH_MODE;
}

export function buildHomepageMatchPath(
  searchParams?: URLSearchParams | RouteParamRecord,
  overrides?: RouteParamRecord,
): string {
  const params = new URLSearchParams();

  if (searchParams instanceof URLSearchParams) {
    for (const [key, value] of searchParams.entries()) {
      params.set(key, value);
    }
  } else if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        if (value[0]) params.set(key, value[0]);
        continue;
      }

      if (value) params.set(key, value);
    }
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (Array.isArray(value)) {
        if (value[0]) {
          params.set(key, value[0]);
        } else {
          params.delete(key);
        }
        continue;
      }

      if (value == null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
  }

  params.delete('match');
  params.set('mode', HOMEPAGE_MATCH_MODE);

  const query = params.toString();
  return query ? `/?${query}` : HOMEPAGE_MATCH_PATH;
}
