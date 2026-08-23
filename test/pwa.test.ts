import { describe, expect, it } from 'vitest';
import { cacheNameFor, isCacheable, staleCaches, strategyFor } from '../src/lib/pwa';

const ORIGIN = 'https://nochords-18219.web.app';
const get = (url: string, mode?: string) => ({ url, method: 'GET', mode });

describe('cache naming', () => {
  it('PW-01 gives every version its own cache', () => {
    expect(cacheNameFor('0.2.0')).toBe('nochords-v0.2.0');
    expect(cacheNameFor('0.2.0')).not.toBe(cacheNameFor('0.2.1'));
  });

  it('PW-02 clears the caches of older versions and nothing else', () => {
    const names = ['nochords-v0.1.0', 'nochords-v0.2.0', 'firebase-installations', 'workbox-x'];
    expect(staleCaches(names, 'nochords-v0.2.0')).toEqual(['nochords-v0.1.0']);
  });

  it('PW-03 leaves another app on the same origin alone', () => {
    // Deleting a cache we did not create would break whatever put it there.
    expect(staleCaches(['some-other-cache'], 'nochords-v0.2.0')).toEqual([]);
  });
});

describe('strategyFor', () => {
  it('PW-04 serves hashed build output from the cache', () => {
    expect(strategyFor(get(`${ORIGIN}/assets/index-abc123.js`), ORIGIN)).toBe('immutable');
    expect(strategyFor(get(`${ORIGIN}/assets/index-abc123.css`), ORIGIN)).toBe('immutable');
  });

  it('PW-05 lets the network decide what a page load is', () => {
    expect(strategyFor(get(`${ORIGIN}/`, 'navigate'), ORIGIN)).toBe('navigate');
  });

  it('PW-06 **never touches cross-origin traffic**', () => {
    // Firestore is the reason. Caching its responses would serve stale songs, and intercepting
    // its stream would break sync outright.
    expect(strategyFor(get('https://firestore.googleapis.com/v1/projects/x'), ORIGIN)).toBe(
      'passthrough'
    );
    expect(strategyFor(get('https://www.googleapis.com/identitytoolkit/v3'), ORIGIN)).toBe(
      'passthrough'
    );
  });

  it('PW-07 ignores anything that is not a GET', () => {
    expect(strategyFor({ url: `${ORIGIN}/`, method: 'POST' }, ORIGIN)).toBe('passthrough');
    expect(strategyFor({ url: `${ORIGIN}/x`, method: 'HEAD' }, ORIGIN)).toBe('passthrough');
  });

  it('PW-08 revalidates the rest of our own files', () => {
    expect(strategyFor(get(`${ORIGIN}/icons/icon-192.png`), ORIGIN)).toBe('revalidate');
    expect(strategyFor(get(`${ORIGIN}/manifest.webmanifest`), ORIGIN)).toBe('revalidate');
  });

  it('PW-09 passes through a request whose url will not parse', () => {
    expect(strategyFor(get('not a url'), ORIGIN)).toBe('passthrough');
  });
});

describe('isCacheable', () => {
  it('PW-10 keeps a plain successful response', () => {
    expect(isCacheable({ ok: true, status: 200, type: 'basic' })).toBe(true);
  });

  it('PW-11 refuses errors, redirects and opaque responses', () => {
    expect(isCacheable({ ok: false, status: 404, type: 'basic' })).toBe(false);
    expect(isCacheable({ ok: false, status: 500, type: 'basic' })).toBe(false);
    // An opaque response has status 0 and contents we cannot see; caching one caches a mystery.
    expect(isCacheable({ ok: false, status: 0, type: 'opaque' })).toBe(false);
    expect(isCacheable({ ok: true, status: 206, type: 'basic' })).toBe(false);
  });
});
