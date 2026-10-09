/**
 * What the tempo number counts (ADR-052).
 *
 * A bare BPM is ambiguous the moment a meter is compound: "6/8 at 180" means one thing to someone
 * counting eighths and another to someone counting the dotted-quarter pulse, and the two differ by
 * a factor of three. A tempo here is a number *and* the note value it counts.
 *
 * Everything is converted through quarter notes, which no meter or unit has an opinion about, so
 * there are no meter-specific cases anywhere: ♪=180 in 6/8 and ♩=90 in 3/4 arrive at the same bar
 * length because they describe the same thing.
 *
 * Two units are offered, the eighth and the quarter (ADR-086). The dotted quarter there used to be
 * is read once, when a song saved in it loads, and turned into the same speed in one of these.
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

export type TempoUnit = 'eighth' | 'quarter';

/**
 * The units offered, with what each is worth in quarter notes, and as a fraction of a whole note —
 * the name for a reader who does not read note shapes at a glance (ADR-085).
 */
export const TEMPO_UNITS: ReadonlyArray<{
  value: TempoUnit;
  symbol: string;
  fraction: string;
  name: string;
  quarters: number;
}> = [
  { value: 'eighth', symbol: '♪', fraction: '1/8', name: 'eighth note', quarters: 0.5 },
  { value: 'quarter', symbol: '♩', fraction: '1/4', name: 'quarter note', quarters: 1 },
];

export const DEFAULT_TEMPO_UNIT: TempoUnit = 'quarter';

export function isTempoUnit(value: unknown): value is TempoUnit {
  return TEMPO_UNITS.some((unit) => unit.value === value);
}

/** What one tempo beat is worth in quarter notes. */
export function quartersPerTempoBeat(unit: TempoUnit): number {
  return TEMPO_UNITS.find((entry) => entry.value === unit)?.quarters ?? 1;
}

/** How the unit is offered in a list: the note, then what it is worth — `♩ – 1/4`. */
export function tempoUnitLabel(unit: TempoUnit): string {
  const entry = TEMPO_UNITS.find((candidate) => candidate.value === unit);
  return entry ? `${entry.symbol} – ${entry.fraction}` : '♩ – 1/4';
}

/** How the unit is written: ♪ or ♩. */
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
 * Compound meters are counted in the eighths they are written in — 6/8 at ♪ = 180 — now that their
 * dotted pulse is no longer offered (ADR-086). Simple meters take the quarter.
 */
export function preferredTempoUnit(meter: string): TempoUnit {
  const parsed = parseMeter(meter);
  if (!parsed) return DEFAULT_TEMPO_UNIT;
  const compound = parsed.unit >= 8 && parsed.beatsPerBar > 3 && parsed.beatsPerBar % 3 === 0;
  return compound ? 'eighth' : 'quarter';
}

/** What the dotted quarter was worth in quarter notes, for reading songs saved in it. */
const DOTTED_QUARTER_QUARTERS = 1.5;

/**
 * A tempo saved in the dotted quarter, as the same speed in a unit still offered (ADR-086).
 *
 * Eighths when the number fits — ♩. = 60 is exactly ♪ = 180, three to one — and quarters above
 * that, where three times the number would pass the field's ceiling: ♩. = 120 is ♩ = 180. Only
 * there can it move at all, by rounding half a beat a minute, and only past ♩. = 200 is it capped.
 */
export function fromDottedQuarter(tempo: number): { tempo: number; tempoUnit: TempoUnit } {
  const eighths = tempo * (DOTTED_QUARTER_QUARTERS / 0.5);
  if (eighths <= MAX_TEMPO) return { tempo: eighths, tempoUnit: 'eighth' };
  return {
    tempo: Math.min(Math.round(tempo * DOTTED_QUARTER_QUARTERS), MAX_TEMPO),
    tempoUnit: 'quarter',
  };
}
