/**
 * Time signatures.
 *
 * A meter answers two questions the rest of the app asks: how many beats a bar holds, and which of
 * those beats carry the accented click. Everything else stays in beats, exactly as before — the
 * meter is what lets a row say "two bars" and the metronome say "pulse here" (ADR-026).
 *
 * A beat is one unit of the signature's denominator: an eighth in 6/8, a quarter in 3/4. The
 * song's tempo counts those units, so nothing about existing timing changes.
 */

/** What a song is in when it does not say. Four beats to the bar, accent on the first. */
export const DEFAULT_METER = '4/4';

export interface Meter {
  /** Beats in a bar — the numerator. */
  beatsPerBar: number;
  /** What one beat is — the denominator. */
  unit: number;
}

/** A signature written as `n/d`, or `null` if that is not what this text is. */
export function parseMeter(text: string): Meter | null {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
  if (!match) return null;

  const beatsPerBar = Number(match[1]);
  const unit = Number(match[2]);
  if (!Number.isInteger(beatsPerBar) || beatsPerBar < 1) return null;
  // Only real note values: a bar of "n/5" is not a thing anyone writes.
  if (![1, 2, 4, 8, 16, 32].includes(unit)) return null;

  return { beatsPerBar, unit };
}

/** Whether a meter groups its beats in threes: 6/8, 9/8, 12/8 and their kin. */
export function isCompound(meter: Meter): boolean {
  return meter.unit >= 8 && meter.beatsPerBar > 3 && meter.beatsPerBar % 3 === 0;
}

/**
 * How often the accent falls, in beats.
 *
 * Simple meters accent the first beat of the bar. Compound meters are felt in their dotted pulse
 * rather than one accent per bar — 6/8 is two pulses of three, not a lone click every six, which
 * is the whole reason a 6/8 song sounded wrong against a bar-length accent.
 */
export function accentEvery(meter: Meter): number {
  return isCompound(meter) ? 3 : meter.beatsPerBar;
}

/** Beats in one bar of `text`, falling back to the default for anything unreadable. */
export function beatsPerBarOf(text: string | null | undefined): number {
  const meter = parseMeter(text ?? '') ?? parseMeter(DEFAULT_METER);
  return meter ? meter.beatsPerBar : 4;
}

/** How often the accent falls in `text`, falling back to the default for anything unreadable. */
export function accentEveryOf(text: string | null | undefined): number {
  const meter = parseMeter(text ?? '') ?? parseMeter(DEFAULT_METER);
  return meter ? accentEvery(meter) : 4;
}

/** The signatures offered in the editor. Anything else can still be typed inline. */
export const COMMON_METERS = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '5/4', '7/8'];
