/**
 * The service worker: what makes the app installable and usable offline (ADR-028).
 *
 * Deliberately thin. Every decision it makes lives in `lib/pwa.ts` where tests can reach it; this
 * file is the plumbing that connects those decisions to the Cache API.
 *
 * `__APP_VERSION__` and `__PRECACHE__` are replaced at build time by the plugin in
 * `vite.config.ts`, which is the only place that knows the hashed file names.
 */
/// <reference lib="webworker" />
import { cacheNameFor, isCacheable, staleCaches, strategyFor } from './lib/pwa';

declare const __APP_VERSION__: string;
declare const __PRECACHE__: string[];

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = cacheNameFor(__APP_VERSION__);

/**
 * Match on the URL alone.
 *
 * Hosting sends `Vary: Origin`, and a precached response was stored against a fetch that carried
 * no `Origin` header. A module script or stylesheet requested by the page does carry one, so the
 * default match misses and falls through to a network that, offline, is not there — the app loads
 * its shell and then fails to boot. Our cache only ever holds same-origin GETs whose URL fixes
 * their contents, so honouring `Vary` buys nothing and costs everything (ADR-028).
 */
const MATCH: CacheQueryOptions = { ignoreVary: true };

worker.addEventListener('install', (event) => {
  // No skipWaiting: a new version waits for every tab to close and takes over on the next cold
  // start, so nothing is swapped underneath someone playing a song (ADR-028).
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(__PRECACHE__)));
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(staleCaches(names, CACHE).map((name) => caches.delete(name)));
      // Claim only matters on first install: it lets the very first visit work offline without a
      // reload. It does not pull a waiting version forward.
      await worker.clients.claim();
    })()
  );
});

/** Puts a response in the cache when it is worth keeping, and hands it back untouched. */
async function keep(request: Request, response: Response): Promise<Response> {
  if (isCacheable(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

worker.addEventListener('fetch', (event) => {
  const strategy = strategyFor(event.request, worker.location.origin);
  if (strategy === 'passthrough') return;

  if (strategy === 'immutable') {
    event.respondWith(
      caches
        .match(event.request, MATCH)
        .then((hit) => hit ?? fetch(event.request).then((response) => keep(event.request, response)))
    );
    return;
  }

  if (strategy === 'navigate') {
    /*
     * The network decides what the app is; the cache is only the offline answer.
     *
     * `cache: 'reload'` because a plain fetch reads the browser's HTTP cache first, and that cache
     * is not ours to reason about: the app was pinned to an old release for an hour at a time by a
     * cacheable response on `/`, restarting it as often as you liked (ADR-056). "Network-first"
     * has to mean the network or it means nothing.
     */
    event.respondWith(
      fetch(event.request.url, { cache: 'reload', credentials: 'same-origin' })
        .then((response) => keep(event.request, response))
        .catch(async () => (await caches.match('/index.html', MATCH)) ?? Response.error())
    );
    return;
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(event.request, MATCH);
      const fresh = fetch(event.request)
        .then((response) => keep(event.request, response))
        .catch(() => undefined);
      return hit ?? (await fresh) ?? Response.error();
    })()
  );
});
