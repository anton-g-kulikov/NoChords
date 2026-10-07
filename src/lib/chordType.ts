/**
 * Setting a chord symbol the way a printed chart does (ADR-068).
 *
 * A lead sheet sets the root large and the quality small — `A♭` and then `m7` — because the root
 * is what you read from across the room and the quality is what you check once you are there. The
 * same split works for numerals: `♭VII` is the head, `maj7` the rest.
 *
 * Pure text in, text out: it only decides where the cuts go and swaps `#`/`b` for the real signs.
 * Anything it does not recognise comes back whole, as a head with nothing after it.
 */

export interface ChordParts {
  /**
   * A letter chord, a numeral, or text it could not read. Numerals are set in the serif: in a sans,
   * `III` is three bars and reads as a time signature's worth of pipes.
   */
  kind: 'letter' | 'numeral' | 'other';
  /** The root with its accidental, or the numeral with its prefix. */
  head: string;
  /** Quality and extensions, after the root: `m7`, `sus4`, `°7`. */
  tail: string;
  /** The bass after a slash, including the slash: `/E`. Empty without one. */
  bass: string;
}

const LETTER = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;
const NUMERAL = /^([#b]?)([IViv]+)(.*?)(?:\/([#b]?)([IViv]+))?$/;

/** `#` and `b` as signs. In a quality only before a digit, so `sus` and `add` keep their letters. */
const sign = (accidental: string): string =>
  accidental === '#' ? '♯' : accidental === 'b' ? '♭' : accidental;
const signsIn = (quality: string): string =>
  quality.replace(/([#b])(?=\d)/g, (accidental: string) => sign(accidental));

export function chordParts(symbol: string): ChordParts {
  const letter = LETTER.exec(symbol);
  if (letter) {
    const [, root, accidental, quality, bassRoot, bassAccidental] = letter;
    return {
      kind: 'letter',
      head: root + sign(accidental),
      tail: signsIn(quality),
      bass: bassRoot ? `/${bassRoot}${sign(bassAccidental)}` : '',
    };
  }

  const numeral = NUMERAL.exec(symbol);
  if (numeral) {
    const [, accidental, degree, quality, bassAccidental, bassDegree] = numeral;
    return {
      kind: 'numeral',
      head: sign(accidental) + degree,
      tail: signsIn(quality),
      bass: bassDegree ? `/${sign(bassAccidental)}${bassDegree}` : '',
    };
  }

  return { kind: 'other', head: symbol, tail: '', bass: '' };
}

/** A key or chord as one string with its signs set — `B♭m` — for places too small to split it. */
export function withSigns(symbol: string): string {
  const { head, tail, bass } = chordParts(symbol);
  return head + tail + bass;
}
