/** Major keys offered in the UI: one practical spelling per pitch class. */
export const MAJOR_KEYS = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

/** Minor keys, spelled as their conventional key signatures suggest. */
export const MINOR_KEYS = [
  'Am',
  'Bbm',
  'Bm',
  'Cm',
  'C#m',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
] as const;

export const KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

export type KeyName = (typeof KEYS)[number];
