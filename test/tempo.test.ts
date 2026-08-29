import { describe, expect, it } from 'vitest';
import {
  MAX_TEMPO,
  MIN_TEMPO,
  isTempoUnit,
  msPerBar,
  msPerMeterBeat,
  preferredTempoUnit,
  quarterNotesPerBar,
  quartersPerTempoBeat,
  tempoUnitSymbol,
  unitFromMeterDenominator,
} from '../src/lib/tempo';

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
    expect(quartersPerTempoBeat('dottedQuarter')).toBe(1.5);
  });
});

describe('msPerBar', () => {
  it('TU-04 times a bar from the meter, the number and the unit', () => {
    expect(msPerBar('4/4', 120, 'quarter')).toBe(2000);
    expect(msPerBar('3/4', 60, 'quarter')).toBe(3000);
    expect(msPerBar('6/8', 60, 'dottedQuarter')).toBe(2000);
    expect(msPerBar('6/8', 180, 'eighth')).toBe(2000);
  });

  it('TU-05 reads the same tempo two ways as the same music (ADR-052)', () => {
    // The spec's own equivalence: ♪ = 180 and ♩. = 60 are the same 6/8.
    expect(msPerBar('6/8', 180, 'eighth')).toBe(msPerBar('6/8', 60, 'dottedQuarter'));
  });

  it('TU-06 floors a nonsensical tempo rather than returning forever', () => {
    expect(msPerBar('4/4', 0, 'quarter')).toBe(msPerBar('4/4', MIN_TEMPO, 'quarter'));
    expect(Number.isFinite(msPerBar('4/4', -10, 'quarter'))).toBe(true);
  });
});

describe('msPerMeterBeat', () => {
  it('TU-07 is the meter’s own unit, not the tempo’s', () => {
    // 6/8 counts six eighths a bar however its tempo happens to be written.
    expect(msPerMeterBeat('6/8', 60, 'dottedQuarter')).toBeCloseTo(333.333, 3);
    expect(msPerMeterBeat('6/8', 180, 'eighth')).toBeCloseTo(333.333, 3);
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
    expect(preferredTempoUnit('6/8')).toBe('dottedQuarter');
    expect(preferredTempoUnit('9/8')).toBe('dottedQuarter');
    expect(preferredTempoUnit('12/8')).toBe('dottedQuarter');
    // 7/8 is compound only by denominator; it is counted in eighths, so the quarter stands.
    expect(preferredTempoUnit('7/8')).toBe('quarter');
    expect(preferredTempoUnit('nonsense')).toBe('quarter');
  });

  it('TU-10 recognises only the units it offers', () => {
    expect(isTempoUnit('quarter')).toBe(true);
    expect(isTempoUnit('dottedQuarter')).toBe(true);
    expect(isTempoUnit('half')).toBe(false);
    expect(isTempoUnit(120)).toBe(false);
    expect(isTempoUnit(undefined)).toBe(false);
  });

  it('TU-11 writes each unit as its note', () => {
    expect(tempoUnitSymbol('eighth')).toBe('♪');
    expect(tempoUnitSymbol('quarter')).toBe('♩');
    expect(tempoUnitSymbol('dottedQuarter')).toBe('♩.');
  });
});

describe('the bounds', () => {
  it('TU-14 bounds stay usable at both ends', () => {
    expect(MIN_TEMPO).toBeLessThan(MAX_TEMPO);
    expect(msPerBar('4/4', MAX_TEMPO, 'quarter')).toBeGreaterThan(0);
  });
});
