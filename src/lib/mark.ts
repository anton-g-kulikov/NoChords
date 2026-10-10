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

/**
 * The same brackets cut lighter, for the lockup that sets the name between them (ADR-100). At the
 * capitals' height beside a semibold serif, the icon's strokes read a weight darker than the type;
 * these match the letters' stems instead. Same lean, same proportions — only the strokes are thinner.
 * The icon keeps the heavier cut, which it needs to hold at 16px.
 */
export const LOCKUP_OPEN = 'M162.4 120H242.4L238.2 142H184.2L139.8 370H193.8L189.6 392H109.6Z';

export const LOCKUP_CLOSE = 'M402.4 120H322.4L318.2 142H372.2L327.8 370H273.8L269.6 392H349.6Z';

export const LOCKUP_PATHS = [LOCKUP_OPEN, LOCKUP_CLOSE] as const;
