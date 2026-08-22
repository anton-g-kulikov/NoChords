/**
 * What a partly-typed number field should store (ADR-019).
 *
 * A number input has to represent the states a user passes *through* while editing — empty,
 * half-typed, briefly out of range — and none of those should be committed. Binding the input
 * straight to a parsed number cannot express them, which is how `Number('') || previous` came to
 * restore the old value on the keystroke that cleared the field.
 */

/** Plain decimal only: no exponents, no trailing dot, no stray characters. */
const NUMERIC = /^-?\d+(?:\.\d+)?$/;

/**
 * The number this text should commit, or `null` to commit nothing and leave the last good value
 * in place. Out-of-range text is deliberately not clamped: `8` typed on the way to `80` is a
 * moment in the middle of an edit, not an instruction to set the tempo to the minimum.
 */
export function commitValue(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim();
  if (!NUMERIC.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;

  return parsed;
}
