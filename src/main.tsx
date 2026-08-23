import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
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
