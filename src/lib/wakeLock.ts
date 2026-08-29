/**
 * Whether to hold the screen awake (ADR-035).
 *
 * The decision is separated from the API call because the API is unmockable in a node test and the
 * rule is the part worth pinning: hold it while playing and visible, never otherwise.
 */

/** The subset of `navigator` this needs, so the decision can be tested without one. */
export interface WakeLockCapable {
  wakeLock?: unknown;
}

/** Whether this browser can hold a screen wake lock at all. */
export function supportsWakeLock(nav: WakeLockCapable | undefined | null): boolean {
  return Boolean(nav && nav.wakeLock);
}

/**
 * Whether the lock should be held right now.
 *
 * Only while playing: a lock held over a paused song is a flat battery by the interval. Only while
 * visible, because a hidden page cannot hold one anyway — the browser drops it, which is why it
 * has to be asked for again when the page comes back.
 */
export function shouldHoldWakeLock(input: { isPlaying: boolean; visible: boolean }): boolean {
  return input.isPlaying && input.visible;
}
