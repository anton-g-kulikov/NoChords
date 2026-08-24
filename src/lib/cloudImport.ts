import type { StorageLike } from './storage';

/**
 * Whether signing in should offer to carry local songs up to the account (ADR-022).
 *
 * Deliberately a function of the two counts alone. Inspecting the songs — to spot the example
 * library, say — would mean matching on titles, which breaks the moment one is renamed. One extra
 * question the user declines is a far better failure than a library that silently duplicates.
 */
export function shouldOfferImport(localCount: number, cloudCount: number): boolean {
  // Only into an empty account: otherwise "import" would mean concatenating two libraries that
  // share no identity, which is duplication rather than a merge.
  return localCount > 0 && cloudCount <= 0;
}

/**
 * Ids that were meant to reach the account but are not there.
 *
 * The import writes each song under its own id, so it is idempotent: running it twice overwrites
 * rather than duplicates. That is what makes checking afterwards worth doing — anything missing
 * can simply be sent again (ADR-031).
 */
export function missingFromAccount(localIds: string[], accountIds: string[]): string[] {
  const present = new Set(accountIds);
  return localIds.filter((id) => !present.has(id));
}

/**
 * Whether this device has already imported into this account.
 *
 * A shared id says so: songs are written under the id they have on the device, so an account
 * holding one of them was written to from here. Finishing that import is not the merge of two
 * unrelated libraries ADR-022 refused — it is completing what this device started, which is why
 * the offer may be made even into an account that is not empty (ADR-031).
 *
 * This is what rescues an import that failed before there was a flag to record it.
 */
export function hasImportedHere(localIds: string[], accountIds: string[]): boolean {
  const present = new Set(accountIds);
  return localIds.some((id) => present.has(id));
}

/** Where an unfinished import is remembered, so a reload does not strand the rest. */
export const UNFINISHED_IMPORT_KEY = 'nochords.import-unfinished.v1';

/**
 * Whether an import was accepted and did not finish.
 *
 * Without this the offer never returns: it is only made into an empty account, and a partial
 * import leaves the account non-empty. The songs left behind would have nowhere to go.
 */
export function hasUnfinishedImport(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(UNFINISHED_IMPORT_KEY) !== null;
  } catch {
    return false;
  }
}

export function markImportUnfinished(storage: StorageLike | null, unfinished: boolean): void {
  if (!storage) return;
  try {
    if (unfinished) storage.setItem(UNFINISHED_IMPORT_KEY, 'true');
    else storage.removeItem(UNFINISHED_IMPORT_KEY);
  } catch {
    // Nothing useful to do; the offer simply will not survive a reload.
  }
}

