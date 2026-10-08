/**
 * The app's mark: a quaver, drawn on the 512 grid of the installed icons (ADR-070).
 *
 * The header draws it inline so it can take the scheme's colours, which an `<img>` cannot. It is
 * still one drawing — the icon SVGs in `public/icons/` carry exactly these shapes, and a test
 * fails the moment either changes without the other (MK-01).
 */

/** The note head, as a path. */
export const MARK_HEAD =
  'M274.5 324.7C284.9 353.2 262.2 387.7 223.8 401.7C185.4 415.7 145.9 403.9 135.5 375.3C125.1 346.8 147.8 312.3 186.2 298.3C224.6 284.3 264.1 296.1 274.5 324.7Z';

/** The stem, as a rounded rectangle. */
export const MARK_STEM = { x: 262, y: 120, width: 26, height: 232, rx: 13 } as const;

/** The flag, as a path. */
export const MARK_FLAG = 'M288 120c52 25 92 50 92 100 0 28-15 50-39 66 8-33-5-58-53-84z';
