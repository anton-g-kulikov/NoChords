import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const hosting = JSON.parse(read('firebase.json')).hosting as { headers: HeaderRule[] };
const everyPage = hosting.headers.find((rule) => rule.source === '**');
const header = (key: string) => everyPage?.headers.find((entry) => entry.key === key)?.value ?? '';
// Report-only for now; enforcing is the same policy under the other key (ADR-108).
const policy = header('Content-Security-Policy') || header('Content-Security-Policy-Report-Only');
const directive = (name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? '';

describe('hosting headers (ADR-108)', () => {
  it('HS-01 every response carries the security headers', () => {
    expect(everyPage).toBeDefined();
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toContain('microphone=()');
    expect(policy).not.toBe('');
  });

  it('HS-02 **the content policy allows the inline theme script by its exact hash**', () => {
    // index.html's one inline script runs before React to paint the chosen theme (ADR-067). The
    // build leaves it byte for byte, so its hash here is the hash the browser computes; editing the
    // script without updating firebase.json fails this test rather than the theme.
    const scripts = [...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts).toHaveLength(1);
    const hash = createHash('sha256').update(scripts[0]).digest('base64');
    expect(directive('script-src')).toContain(`'sha256-${hash}'`);
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
  });

  it('HS-03 nothing may frame the app, embed plugins, or redirect forms and the base URL', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
    expect(directive('form-action')).toBe("form-action 'self'");
  });

  it('HS-05 keeps styles to the app\'s own stylesheet, and leaves the screen wake lock allowed', () => {
    // The built page has no inline styles, and React's style props go through the CSSOM, which a
    // policy does not block.
    expect(directive('style-src')).toBe("style-src 'self'");
    // The chart keeps the screen awake while a song plays (ADR-035): a tidy-up that denied
    // screen-wake-lock here would quietly bring back the screen dimming mid-song.
    expect(header('Permissions-Policy')).not.toContain('screen-wake-lock');
  });

  it('HS-04 the cache rules that keep a deploy live are unchanged (ADR-056)', () => {
    const cache = (source: string) =>
      hosting.headers.find((rule) => rule.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value;
    expect(cache('/')).toBe('no-cache');
    expect(cache('/sw.js')).toBe('no-cache');
    expect(cache('/assets/**')).toContain('immutable');
  });
});
