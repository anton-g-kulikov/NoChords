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
