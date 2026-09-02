/**
 * When the library knows which songs it is meant to be showing (ADR-062).
 *
 * Signing in changes where songs come from, and the answer arrives in two steps: first whether
 * anyone is signed in, then the account's own store, which is fetched on demand (ADR-023). Until
 * both have answered, the only library available is the device's — and showing it is a guess that
 * gets corrected on screen a moment later.
 */

/**
 * Whether the library must wait rather than show what it has.
 *
 * `authPending` is the sign-in check still running; `cloudResolved` is the account store having
 * answered, whether or not there turned out to be one.
 */
export function isAwaitingAccount(
  authPending: boolean,
  uid: string | null,
  cloudResolved: boolean
): boolean {
  if (authPending) return true;
  return uid !== null && !cloudResolved;
}
