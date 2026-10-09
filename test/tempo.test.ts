import { describe, expect, it } from 'vitest';
import {
  MAX_TEMPO,
  MIN_TEMPO,
  TEMPO_UNITS,
  fromDottedQuarter,
  isTempoUnit,
  msPerBar,
  msPerMeterBeat,
  preferredTempoUnit,
  quarterNotesPerBar,
  quartersPerTempoBeat,
  tempoUnitLabel,
  tempoUnitSymbol,
  unitFromMeterDenominator,
} from '../src/lib/tempo';
import { buildSchedule } from '../src/lib/playback';
import type { SongRow } from '../src/types/song';

const row = (id: string): SongRow => ({
  id,
  lyrics: id,
  chords: [],
  bars: null,
  meter: null,
});

describe('quarterNotesPerBar', () => {
  it('TU-01 measures a bar in quarter notes', () => {
    expect(quarterNotesPerBar('4/4')).toBe(4);
    expect(quarterNotesPerBar('3/4')).toBe(3);
    expect(quarterNotesPerBar('6/8')).toBe(3);
    expect(quarterNotesPerBar('12/8')).toBe(6);
    expect(quarterNotesPerBar('7/8')).toBe(3.5);
  });

  it('TU-02 falls back to a bar of four for an unreadable meter', () => {
    expect(quarterNotesPerBar('nonsense')).toBe(4);
  });
});

describe('quartersPerTempoBeat', () => {
  it('TU-03 is what each unit is worth in quarter notes', () => {
    expect(quartersPerTempoBeat('eighth')).toBe(0.5);
    expect(quartersPerTempoBeat('quarter')).toBe(1);
  });
});

describe('msPerBar', () => {
  it('TU-04 times a bar from the meter, the number and the unit', () => {
    expect(msPerBar('4/4', 120, 'quarter')).toBe(2000);
    expect(msPerBar('3/4', 60, 'quarter')).toBe(3000);
    expect(msPerBar('6/8', 180, 'eighth')).toBe(2000);
  });

  it('TU-05 reads a tempo saved in the dotted quarter as the same music in eighths (ADR-086)', () => {
    // ♩. = 60 in 6/8 was a two-second bar; it loads as ♪ = 180, which is the same two seconds.
    expect(fromDottedQuarter(60)).toEqual({ tempo: 180, tempoUnit: 'eighth' });
    expect(msPerBar('6/8', 180, 'eighth')).toBe(2000);
    expect(fromDottedQuarter(100)).toEqual({ tempo: 300, tempoUnit: 'eighth' });
  });

  it('TU-06 floors a nonsensical tempo rather than returning forever', () => {
    expect(msPerBar('4/4', 0, 'quarter')).toBe(msPerBar('4/4', MIN_TEMPO, 'quarter'));
    expect(Number.isFinite(msPerBar('4/4', -10, 'quarter'))).toBe(true);
  });
});

describe('msPerMeterBeat', () => {
  it('TU-07 is the meter’s own unit, not the tempo’s', () => {
    // 6/8 counts six eighths a bar however its tempo happens to be written.
    expect(msPerMeterBeat('6/8', 180, 'eighth')).toBeCloseTo(333.333, 3);
    expect(msPerMeterBeat('6/8', 90, 'quarter')).toBeCloseTo(333.333, 3);
    expect(msPerMeterBeat('4/4', 120, 'quarter')).toBe(500);
  });
});

describe('unit defaults', () => {
  it('TU-08 reads an old tempo as the meter’s denominator, preserving how it sounded', () => {
    expect(unitFromMeterDenominator('4/4')).toBe('quarter');
    expect(unitFromMeterDenominator('3/4')).toBe('quarter');
    expect(unitFromMeterDenominator('6/8')).toBe('eighth');
    expect(unitFromMeterDenominator('12/8')).toBe('eighth');
  });

  it('TU-09 offers a new song the unit its meter is counted in', () => {
    expect(preferredTempoUnit('2/4')).toBe('quarter');
    expect(preferredTempoUnit('3/4')).toBe('quarter');
    expect(preferredTempoUnit('4/4')).toBe('quarter');
    expect(preferredTempoUnit('5/4')).toBe('quarter');
    // Compound meters are counted in the eighths they are written in (ADR-086).
    expect(preferredTempoUnit('6/8')).toBe('eighth');
    expect(preferredTempoUnit('9/8')).toBe('eighth');
    expect(preferredTempoUnit('12/8')).toBe('eighth');
    // 7/8 is compound only by denominator; it is counted in eighths, so the quarter stands.
    expect(preferredTempoUnit('7/8')).toBe('quarter');
    expect(preferredTempoUnit('nonsense')).toBe('quarter');
  });

  it('TU-10 recognises only the units it offers', () => {
    expect(TEMPO_UNITS.map((unit) => unit.value)).toEqual(['eighth', 'quarter']);
    expect(isTempoUnit('quarter')).toBe(true);
    expect(isTempoUnit('eighth')).toBe(true);
    // No longer offered: read once on load and converted, never accepted as it is (ADR-086).
    expect(isTempoUnit('dottedQuarter')).toBe(false);
    expect(isTempoUnit('half')).toBe(false);
    expect(isTempoUnit(120)).toBe(false);
    expect(isTempoUnit(undefined)).toBe(false);
  });

  it('TU-11 writes each unit as its note', () => {
    expect(tempoUnitSymbol('eighth')).toBe('♪');
    expect(tempoUnitSymbol('quarter')).toBe('♩');
  });

  it('TU-15 offers each unit as its note and its value', () => {
    expect(tempoUnitLabel('eighth')).toBe('♪ – 1/8');
    expect(tempoUnitLabel('quarter')).toBe('♩ – 1/4');
  });

  it('TU-16 **turns a dotted quarter too fast for eighths into quarters, still the same speed**', () => {
    // Three times ♩. = 120 would be ♪ = 360, past the field's 300; ♩ = 180 is the same speed.
    expect(fromDottedQuarter(120)).toEqual({ tempo: 180, tempoUnit: 'quarter' });
    expect(msPerBar('6/8', 180, 'quarter')).toBe(msPerBar('6/8', 360, 'eighth'));
    // An odd number lands on half a beat a minute, and rounds.
    expect(fromDottedQuarter(101)).toEqual({ tempo: 152, tempoUnit: 'quarter' });
    // Only past ♩. = 200 does the ceiling bite.
    expect(fromDottedQuarter(200)).toEqual({ tempo: 300, tempoUnit: 'quarter' });
    expect(fromDottedQuarter(250)).toEqual({ tempo: 300, tempoUnit: 'quarter' });
  });
});

describe('a line at a tempo', () => {
  it('TU-12 times a five-bar line the same either way round (ADR-052)', () => {
    const line = [{ ...row('a'), bars: 5 }];

    // Five bars of 6/8 at ♩. = 60 were ten seconds of thirty beats; converted, they still are.
    const converted = fromDottedQuarter(60);
    const inEighths = buildSchedule(line, 180, 1, '6/8', 'eighth');
    const fromSaved = buildSchedule(line, converted.tempo, 1, '6/8', converted.tempoUnit);

    expect(fromSaved[0].durationMs).toBe(10000);
    expect(fromSaved[0].beats).toBe(30);
    expect(fromSaved).toEqual(inEighths);
  });

  it('TU-13 keeps bars whole — a tempo unit never splits one', () => {
    // 7/8 at a quarter-note tempo is three and a half quarters a bar, and still exactly one bar.
    const schedule = buildSchedule([row('a')], 120, 1, '7/8', 'quarter');
    expect(schedule[0].durationMs).toBe(1750);
    expect(schedule[0].beats).toBe(7);
  });

  it('TU-14 bounds stay usable at both ends', () => {
    expect(MIN_TEMPO).toBeLessThan(MAX_TEMPO);
    expect(msPerBar('4/4', MAX_TEMPO, 'quarter')).toBeGreaterThan(0);
  });
});
