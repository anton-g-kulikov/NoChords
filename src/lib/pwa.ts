/**
 * The decisions the service worker makes, kept here so they can be tested (ADR-028).
 *
 * The worker itself is a thin shell around these: it has no logic a unit test cannot reach, which
 * matters because a service worker is the one piece of the app that can serve a stale version of
 * itself to someone and keep doing it.
 */

/**
 * The cache a version owns.
 *
 * Every release gets its own cache and drops the ones before it, so a deploy can never leave a
 * mixture of old and new files behind. This is what the version number is for.
 */
export function cacheNameFor(version: string): string {
  return `nochords-v${version}`;
}

/** Caches belonging to older releases — everything ours except the one in use. */
export function staleCaches(names: string[], current: string): string[] {
  return names.filter((name) => name.startsWith('nochords-v') && name !== current);
}

/** How a request should be served. */
export type Strategy =
  /** Hashed build output. The name changes when the bytes do, so the cache can be trusted. */
  | 'immutable'
  /** A page load. The network decides, and the cache is the offline fallback. */
  | 'navigate'
  /** Everything else of ours: serve what we have, and refresh it for next time. */
  | 'revalidate'
  /** Not ours to touch. */
  | 'passthrough';

/**
 * Which strategy serves this request.
 *
 * Anything not a same-origin GET is passed straight through, untouched and uncached. That is what
 * keeps Firestore working: its traffic is cross-origin, and a worker that cached it would serve
 * someone yesterday's songs, or break the live connection outright.
 */
export function strategyFor(
  request: { url: string; method: string; mode?: string },
  origin: string
): Strategy {
  if (request.method !== 'GET') return 'passthrough';

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return 'passthrough';
  }
  if (url.origin !== origin) return 'passthrough';

  if (request.mode === 'navigate') return 'navigate';
  // Vite writes content-hashed names into /assets, and hosting serves them immutable.
  if (url.pathname.startsWith('/assets/')) return 'immutable';
  return 'revalidate';
}

/** Whether a response is worth putting in the cache. */
export function isCacheable(response: { ok: boolean; status: number; type: string }): boolean {
  // `opaque` responses have status 0 and unknown content; storing one caches a mystery.
  return response.ok && response.status === 200 && response.type !== 'opaque';
}
