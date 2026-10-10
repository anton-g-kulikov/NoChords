/**
 * The second ink, and the six others it can be swapped for (ADR-072).
 *
 * Tapping the mark in the library header steps to the next one: an easter egg, kept per device like
 * the theme. Seven, one for each note of the scale, in the order of the modes — Ionian first — and
 * then monochrome, the octave, before it comes round again (ADR-110).
 *
 * Every light ink has to read as chord text on paper (at least 4.5:1 on `--bg`), and every dark one
 * on the night background; a test holds each to that (AC-03). Colours are RGB triplets so the
 * stylesheet can derive its washes from one value instead of carrying seven copies of each.
 */

export type AccentName =
  | 'vermilion'
  | 'ochre'
  | 'moss'
  | 'teal'
  | 'indigo'
  | 'plum'
  | 'rose'
  | 'mono';

export interface Accent {
  label: string;
  /** The mode it stands for — the joke under the joke. */
  mode: string;
  /** On paper. */
  light: readonly [number, number, number];
  /** On the night background. */
  dark: readonly [number, number, number];
}

export const ACCENTS: Record<AccentName, Accent> = {
  vermilion: { label: 'Vermilion', mode: 'Ionian', light: [180, 68, 31], dark: [233, 161, 92] },
  ochre: { label: 'Ochre', mode: 'Dorian', light: [133, 96, 10], dark: [220, 194, 90] },
  moss: { label: 'Moss', mode: 'Phrygian', light: [79, 107, 31], dark: [169, 196, 106] },
  teal: { label: 'Teal', mode: 'Lydian', light: [31, 107, 107], dark: [108, 196, 189] },
  indigo: { label: 'Indigo', mode: 'Mixolydian', light: [52, 80, 154], dark: [157, 179, 240] },
  plum: { label: 'Plum', mode: 'Aeolian', light: [122, 61, 138], dark: [201, 160, 220] },
  rose: { label: 'Rose', mode: 'Locrian', light: [168, 50, 90], dark: [239, 147, 174] },
  /**
   * No second ink at all: the music in the page's own ink, near-black on paper and paper on the
   * night. After the seven modes, the eighth step is the first note again — the octave (ADR-110).
   */
  mono: { label: 'Monochrome', mode: 'Octave', light: [29, 26, 22], dark: [236, 229, 216] },
};

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];

export const DEFAULT_ACCENT: AccentName = 'vermilion';

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === 'string' && value in ACCENTS;
}

/** The ink after this one, round to the first again. */
export function nextAccent(current: AccentName): AccentName {
  const index = ACCENT_NAMES.indexOf(current);
  return ACCENT_NAMES[(index + 1) % ACCENT_NAMES.length];
}

/**
 * What goes on the root element's `data-accent`: nothing for the default, whose colours are the
 * stylesheet's own, so a page that never ran this looks exactly like one that chose vermilion.
 */
export function accentAttribute(accent: AccentName): AccentName | null {
  return accent === DEFAULT_ACCENT ? null : accent;
}
