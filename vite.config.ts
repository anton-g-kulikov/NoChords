import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')
) as { version: string };

/** Files served from `public/` that the app should still have with no network. */
/**
 * The icons by the exact URLs the page and manifest ask for, version and all (ADR-075): the cache
 * matches on the whole URL, so an unversioned entry would never answer a versioned request.
 */
const PUBLIC_PRECACHE = [
  '/manifest.webmanifest',
  '/icons/icon.svg?v=2',
  '/icons/icon-192.png?v=2',
  '/icons/icon-512.png?v=2',
];

/**
 * Compiles `src/sw.ts` to a service worker at the site root (ADR-028).
 *
 * It has to be built separately from the app: a worker is its own script, must sit at the root to
 * claim the whole scope, and cannot carry a hashed name — the browser fetches exactly `/sw.js`.
 * Building it here is also the only moment the hashed asset names are known, which is what the
 * worker needs in order to precache them.
 */
function serviceWorker(): Plugin {
  return {
    name: 'nochords-service-worker',
    apply: 'build',
    async generateBundle(_options, bundle) {
      // Only the shell: the entry chunk and its styles. Dynamic chunks are deliberately left
      // out — precaching them would push Firebase's 750kB at every visitor on first load, which
      // is the cost ADR-023 exists to avoid. They cache themselves if they are ever fetched.
      const emitted = Object.entries(bundle)
        .filter(([, output]) => (output.type === 'chunk' ? output.isEntry : true))
        .map(([name]) => name)
        // The Latin cut of each face too, or the first offline start draws the chart in a fallback
        // font (ADR-068). Other scripts are left to cache themselves the first time a song needs
        // them: precaching Cyrillic, Greek and Vietnamese for everybody is most of a megabyte.
        .filter(
          (name) =>
            name.endsWith('.js') ||
            name.endsWith('.css') ||
            (name.endsWith('.woff2') && /-latin-(?!ext)/.test(name))
        )
        .map((name) => `/${name}`);
      // `/` and `/index.html` are the same document to the app and different keys to the cache.
      const precache = ['/', '/index.html', ...emitted, ...PUBLIC_PRECACHE];

      const result = await esbuild({
        entryPoints: [fileURLToPath(new URL('./src/sw.ts', import.meta.url))],
        bundle: true,
        // A classic worker rather than a module one: `type: 'module'` workers are still the
        // narrower target, and this file has no need of imports at runtime.
        format: 'iife',
        target: 'es2020',
        minify: true,
        write: false,
        define: {
          __APP_VERSION__: JSON.stringify(pkg.version),
          __PRECACHE__: JSON.stringify(precache),
        },
      });

      this.emitFile({ type: 'asset', fileName: 'sw.js', source: result.outputFiles[0].text });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
