/**
 * Chord parsing and transposition.
 *
 * This is deliberately *not* a music-theory engine. It understands enough of a chord symbol to
 * move its root around the chromatic circle and to name a scale degree; everything else is carried
 * through untouched. Anything it cannot parse is returned verbatim rather than dropped or
 * mangled (see `_meta/architecture-decisions.md` ADR-006).
 */

/** The bass note of a slash chord, e.g. the `G` of `C/G`. */
export interface ChordBass {
  root: string;
  accidental: string;
}

/** A chord symbol broken into the parts transposition needs. */
export interface ParsedChord {
  /** Natural note letter, `A`–`G`. */
  root: string;
  /** `#`, `b`, or empty. */
  accidental: string;
  /** Everything after the root: `m`, `7`, `maj7`, `sus4`, … Carried through unchanged. */
  suffix: string;
  /** Bass note of a slash chord, or `null`. */
  bass: ChordBass | null;
}

const NOTE_PITCH: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_RE = /^([A-G])([#b]?)$/;
const CHORD_RE = /^([A-G])([#b]?)(.*)$/;

/**
 * Characters and words that may legitimately follow a chord root.
 *
 * Its job is to reject ordinary words that happen to start with a note letter — `Bell` must not
 * parse as B with suffix `ell` — while accepting real chord qualities.
 */
const SUFFIX_RE = /^(?:maj|min|dim|aug|sus|add|alt|dom|M|m|°|ø|Δ|\+|-|\d|#|b|\(|\))*$/;

/** Semitone offset of a note above C, or `null` if the note is not recognised. */
function pitchOf(root: string, accidental: string): number | null {
  const base = NOTE_PITCH[root];
  if (base === undefined) return null;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (base + shift + 12) % 12;
}

/** Parses a bare note such as `F#`. Used for slash-chord basses and key names. */
function parseNote(text: string): ChordBass | null {
  const match = NOTE_RE.exec(text.trim());
  if (!match) return null;
  return { root: match[1], accidental: match[2] };
}

/** A key name split into its tonic and its mode. */
export interface ParsedKey {
  root: string;
  accidental: string;
  minor: boolean;
}

/** Parses a key name such as `C`, `Bb`, `F#m`, or `A minor`. */
export function parseKey(key: string): ParsedKey | null {
  const trimmed = key.trim();
  const minor = /m(in(or)?)?$/i.test(trimmed);
  const note = parseNote(minor ? trimmed.replace(/\s*m(in(or)?)?$/i, '') : trimmed);
  if (!note) return null;
  return { root: note.root, accidental: note.accidental, minor };
}

/** Tonic pitch of a key name, or `null` if it is not a key. */
export function keyPitch(key: string): number | null {
  const parsed = parseKey(key);
  if (!parsed) return null;
  return pitchOf(parsed.root, parsed.accidental);
}

/** Whether a key is minor. */
export function keyIsMinor(key: string): boolean {
  return parseKey(key)?.minor ?? false;
}

/**
 * Whether chords in this key should be spelled with flats.
 *
 * A key signature's accidentals follow from its tonic: F major and every key whose name contains a
 * flat carry flats, as do the minor keys whose relative major does (D, G, C and F minor). This is
 * a naming heuristic, not a full key-signature model, which is all transposition needs.
 */
export function keyUsesFlats(key: string): boolean {
  const parsed = parseKey(key);
  if (!parsed) return false;
  if (parsed.accidental === 'b') return true;
  if (parsed.accidental !== '') return false;
  return parsed.minor
    ? ['D', 'G', 'C', 'F'].includes(parsed.root)
    : parsed.root === 'F';
}

/** Names a pitch class, choosing sharps or flats to suit the target key. */
function spell(pitch: number, useFlats: boolean): string {
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[((pitch % 12) + 12) % 12];
}

/** Parses a chord symbol, or returns `null` if it is not one. */
export function parseChord(symbol: string): ParsedChord | null {
  const trimmed = symbol.trim();
  if (trimmed === '') return null;

  const slashParts = trimmed.split('/');
  if (slashParts.length > 2) return null;

  const [mainText, bassText] = slashParts;
  const match = CHORD_RE.exec(mainText);
  if (!match) return null;

  const [, root, accidental, suffix] = match;
  if (!SUFFIX_RE.test(suffix)) return null;

  let bass: ChordBass | null = null;
  if (bassText !== undefined) {
    bass = parseNote(bassText);
    if (!bass) return null;
  }

  return { root, accidental, suffix, bass };
}

/** Renders a parsed chord back to its symbol. Inverse of {@link parseChord}. */
export function formatChord(chord: ParsedChord): string {
  const bass = chord.bass ? `/${chord.bass.root}${chord.bass.accidental}` : '';
  return `${chord.root}${chord.accidental}${chord.suffix}${bass}`;
}

/**
 * Transposes one chord symbol from one key to another.
 * Unrecognised chords and unrecognised keys leave the text untouched.
 */
export function transposeChord(symbol: string, fromKey: string, toKey: string): string {
  const from = keyPitch(fromKey);
  const to = keyPitch(toKey);
  if (from === null || to === null) return symbol;

  const interval = (to - from + 12) % 12;
  // No transposition means no respelling: `Bb` must stay `Bb`, not become `A#`.
  if (interval === 0) return symbol;

  const chord = parseChord(symbol);
  if (!chord) return symbol;

  const rootPitch = pitchOf(chord.root, chord.accidental);
  if (rootPitch === null) return symbol;

  const useFlats = keyUsesFlats(toKey);
  let result = spell(rootPitch + interval, useFlats) + chord.suffix;

  if (chord.bass) {
    const bassPitch = pitchOf(chord.bass.root, chord.bass.accidental);
    if (bassPitch === null) return symbol;
    result += `/${spell(bassPitch + interval, useFlats)}`;
  }

  return result;
}
