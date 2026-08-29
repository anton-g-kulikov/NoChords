/**
 * Keeps the screen awake while a song plays (ADR-035).
 *
 * A chart you are reading from is a page you never touch, so the phone dims it and then locks it
 * mid-verse. The Screen Wake Lock API exists for exactly this, and is available in Chrome on
 * Android and Safari from iOS 16.4 — over HTTPS, which the installed app always is.
 *
 * Failure-tolerant throughout: an unsupported browser, a refusal under battery saver, or a lock
 * the system takes back are all normal, and none of them should disturb playback.
 */
import { useEffect, useRef } from 'react';
import { shouldHoldWakeLock, supportsWakeLock } from '../lib/wakeLock';

/** What `navigator.wakeLock.request` resolves to, named here so the DOM lib is not required. */
interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
}

export function useWakeLock(isPlaying: boolean): void {
  const sentinel = useRef<Sentinel | null>(null);

  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    if (!supportsWakeLock(nav)) return undefined;

    let released = false;

    const drop = () => {
      const held = sentinel.current;
      sentinel.current = null;
      void held?.release().catch(() => {});
    };

    const sync = () => {
      const wanted = shouldHoldWakeLock({
        isPlaying,
        visible: document.visibilityState === 'visible',
      });
      if (!wanted) {
        drop();
        return;
      }
      if (sentinel.current) return;

      void nav
        .wakeLock!.request('screen')
        .then((held) => {
          // The effect may have been torn down while the request was in flight.
          if (released) {
            void held.release().catch(() => {});
            return;
          }
          sentinel.current = held;
          // The system drops it when the page is hidden or the battery gets low; forget it so the
          // next sync asks again rather than believing it still holds one.
          held.addEventListener('release', () => {
            sentinel.current = null;
          });
        })
        .catch(() => {
          // Refused. Playing without it is the old behaviour, not a broken app.
        });
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', sync);
      drop();
    };
  }, [isPlaying]);
}
