/**
 * The app's mark: an empty pair of brackets, drawn on the 512 grid of the installed icons (ADR-074).
 *
 * `[Am]` is how a chord is written in this app, and the app exists to take the chord away: what is
 * left is `[ ]`. Stems are heavier than the feet, as a typeface draws them, so the two strokes read
 * as one weight. Both lean 11° about the centre — the logo's one italic gesture, which is why the
 * name beside it stands upright. The slant is in the coordinates, not a transform, so every copy is
 * a plain path a test can compare.
 *
 * The header draws it inline so it can take the scheme's colours, which an `<img>` cannot. It is
 * still one drawing — every icon SVG carries exactly these shapes, and a test fails the moment any
 * copy changes without the others (MK-01).
 */

/** The opening bracket. */
export const MARK_OPEN = 'M162.4 120H250.4L244.2 152H196.2L155.8 360H203.8L197.6 392H109.6Z';

/** The closing bracket: the opening one, mirrored about the centre before the lean. */
export const MARK_CLOSE = 'M402.4 120H314.4L308.2 152H356.2L315.8 360H267.8L261.6 392H349.6Z';

export const MARK_PATHS = [MARK_OPEN, MARK_CLOSE] as const;
