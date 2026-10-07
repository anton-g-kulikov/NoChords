import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
/* Bundled, not fetched from a font service: the app has to look like itself offline (ADR-068).
   Each file is split by script and fetched only when a page uses it, so Cyrillic lyrics cost
   nothing to someone singing in English. */
import '@fontsource-variable/literata/opsz.css';
import '@fontsource-variable/literata/opsz-italic.css';
import '@fontsource-variable/instrument-sans/wdth.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/**
 * The service worker exists only in a built app (ADR-028): in dev there is no `sw.js`, and a
 * worker caching a dev server is a way to serve yourself yesterday's code for an afternoon.
 *
 * Registration is deliberately unawaited and failure-tolerant. Offline support is a bonus on top
 * of an app that already works from local storage; nothing here should be able to stop it loading.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
