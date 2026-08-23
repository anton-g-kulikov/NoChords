/**
 * The example songs a new library starts with (ADR-024).
 *
 * Seeding writes them into the device library as ordinary songs, so editing, transposing and
 * deleting them is just library editing — there is no second class of song to special-case.
 *
 * What decides is a flag kept beside the library, never the library being empty: someone who
 * deletes all three has made a decision, and the app has to remember it across reloads.
 */
import type { StorageLike } from './storage';

export const SEEDED_KEY = 'nochords.examples-seeded.v1';

/**
 * Whether this library should be given the example songs.
 *
 * Only ever into an empty library: an existing library belongs to someone who has already
 * started, and three uninvited songs in it would be a surprise, not a welcome.
 */
export function shouldSeedExamples(seeded: boolean, songCount: number): boolean {
  return !seeded && songCount === 0;
}

/**
 * Whether this device has been past the seeding decision before.
 *
 * A blocked store reads as "not yet", which means a private window gets the examples every time.
 * That is the honest answer there: nothing else in the library survives a reload either, so a
 * fresh start including the examples is exactly what that session is.
 */
export function hasSeededExamples(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(SEEDED_KEY) !== null;
  } catch {
    return false;
  }
}

/** Records that the decision has been made, whichever way it went. */
export function markExamplesSeeded(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(SEEDED_KEY, 'true');
  } catch {
    // Quota exceeded or storage blocked: the session keeps working, seeding is reconsidered later.
  }
}
