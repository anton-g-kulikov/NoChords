/**
 * What the tempo number counts (ADR-052).
 *
 * A bare BPM is ambiguous the moment a meter is compound: "6/8 at 180" means one thing to someone
 * counting eighths and another to someone counting the dotted-quarter pulse, and the two differ by
 * a factor of three. A tempo here is a number *and* the note value it counts.
 *
 * Everything is converted through quarter notes, which no meter or unit has an opinion about, so
 * there are no meter-specific cases anywhere: ♪=180 and ♩.=60 in 6/8 arrive at the same bar length
 * because they describe the same thing.
 */
import { beatsPerBarOf, parseMeter } from './meter';

/** Floor applied to a tempo value so a zero or negative one cannot produce an infinite duration. */
export const MIN_TEMPO = 20;

/**
 * Highest tempo value offered.
 *
 * High because the number is only as fast as its unit: 6/8 counted in eighths sits well above what
 * the same music counted in dotted quarters would read (ADR-039, ADR-052).
 */
export const MAX_TEMPO = 300;

export type TempoUnit = 'eighth' | 'quarter' | 'dottedQuarter';

/** The units offered, with what each is worth in quarter notes. */
export const TEMPO_UNITS: ReadonlyArray<{
  value: TempoUnit;
  symbol: string;
  name: string;
  quarters: number;
}> = [
  { value: 'eighth', symbol: '♪', name: 'eighth note', quarters: 0.5 },
  { value: 'quarter', symbol: '♩', name: 'quarter note', quarters: 1 },
  { value: 'dottedQuarter', symbol: '♩.', name: 'dotted quarter', quarters: 1.5 },
];

export const DEFAULT_TEMPO_UNIT: TempoUnit = 'quarter';

export function isTempoUnit(value: unknown): value is TempoUnit {
  return TEMPO_UNITS.some((unit) => unit.value === value);
}

/** What one tempo beat is worth in quarter notes. */
export function quartersPerTempoBeat(unit: TempoUnit): number {
  return TEMPO_UNITS.find((entry) => entry.value === unit)?.quarters ?? 1;
}

/** How the unit is written: ♪, ♩ or ♩. */
export function tempoUnitSymbol(unit: TempoUnit): string {
  return TEMPO_UNITS.find((entry) => entry.value === unit)?.symbol ?? '♩';
}

/**
 * Quarter notes in one bar of a meter: the numerator scaled by what the denominator is worth.
 * 6/8 is six eighths, which is three quarters; 4/4 is four; 3/4 is three.
 */
export function quarterNotesPerBar(meter: string): number {
  const parsed = parseMeter(meter);
  if (!parsed) return 4;
  return parsed.beatsPerBar * (4 / parsed.unit);
}

/** How long one bar lasts, in milliseconds. The one place tempo becomes time. */
export function msPerBar(meter: string, tempo: number, unit: TempoUnit): number {
  const safeTempo = Math.max(tempo, MIN_TEMPO);
  const msPerTempoBeat = 60000 / safeTempo;
  const msPerQuarter = msPerTempoBeat / quartersPerTempoBeat(unit);
  return quarterNotesPerBar(meter) * msPerQuarter;
}

/**
 * How long one beat of the *meter* lasts — an eighth in 6/8, a quarter in 3/4.
 *
 * This is the metronome's grid, which follows the meter and not the tempo unit: 6/8 clicks six
 * times a bar however its tempo is written down.
 */
export function msPerMeterBeat(meter: string, tempo: number, unit: TempoUnit): number {
  return msPerBar(meter, tempo, unit) / beatsPerBarOf(meter);
}

/**
 * The unit a song's tempo was written in before units existed (ADR-052).
 *
 * The old engine counted the meter's own denominator: a beat was an eighth in 6/8 and a quarter in
 * 4/4. Reading an old number that way keeps every existing song sounding exactly as it did, which
 * matters more than the number looking conventional.
 */
export function unitFromMeterDenominator(meter: string): TempoUnit {
  return parseMeter(meter)?.unit === 8 ? 'eighth' : 'quarter';
}

/**
 * The unit to offer a *new* song in this meter.
 *
 * Compound meters are counted in their dotted pulse — 6/8 is two, not six — so that is the number
 * a musician would quote. Simple meters take the quarter.
 */
export function preferredTempoUnit(meter: string): TempoUnit {
  const parsed = parseMeter(meter);
  if (!parsed) return DEFAULT_TEMPO_UNIT;
  const compound = parsed.unit >= 8 && parsed.beatsPerBar > 3 && parsed.beatsPerBar % 3 === 0;
  return compound ? 'dottedQuarter' : 'quarter';
}
