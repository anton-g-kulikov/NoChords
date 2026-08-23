import { describe, expect, it } from 'vitest';
import {
  DEFAULT_METER,
  accentEvery,
  accentEveryOf,
  beatsPerBarOf,
  isCompound,
  parseMeter,
} from '../src/lib/meter';

describe('parseMeter', () => {
  it('ME-01 reads a signature into its numerator and denominator', () => {
    expect(parseMeter('6/8')).toEqual({ beatsPerBar: 6, unit: 8 });
    expect(parseMeter('4/4')).toEqual({ beatsPerBar: 4, unit: 4 });
    expect(parseMeter(' 3 / 4 ')).toEqual({ beatsPerBar: 3, unit: 4 });
  });

  it('ME-02 rejects anything that is not a signature', () => {
    expect(parseMeter('')).toBeNull();
    expect(parseMeter('common')).toBeNull();
    expect(parseMeter('4')).toBeNull();
    expect(parseMeter('0/4')).toBeNull();
    // A denominator has to be a real note value.
    expect(parseMeter('4/5')).toBeNull();
    expect(parseMeter('4/0')).toBeNull();
  });
});

describe('accent placement', () => {
  it('ME-03 accents once a bar in a simple meter', () => {
    expect(accentEveryOf('4/4')).toBe(4);
    expect(accentEveryOf('3/4')).toBe(3);
    expect(accentEveryOf('2/4')).toBe(2);
    expect(accentEveryOf('5/4')).toBe(5);
  });

  it('ME-04 accents the dotted pulse in a compound meter', () => {
    // The whole point: 6/8 is two pulses of three, not one click every six.
    expect(isCompound({ beatsPerBar: 6, unit: 8 })).toBe(true);
    expect(accentEveryOf('6/8')).toBe(3);
    expect(accentEveryOf('9/8')).toBe(3);
    expect(accentEveryOf('12/8')).toBe(3);
  });

  it('ME-05 treats 3/8 as simple, since three eighths are one pulse not three', () => {
    expect(isCompound({ beatsPerBar: 3, unit: 8 })).toBe(false);
    expect(accentEvery({ beatsPerBar: 3, unit: 8 })).toBe(3);
  });

  it('ME-06 falls back to four rather than failing on nonsense', () => {
    expect(DEFAULT_METER).toBe('4/4');
    expect(accentEveryOf('nonsense')).toBe(4);
    expect(accentEveryOf(null)).toBe(4);
    expect(accentEveryOf(undefined)).toBe(4);
    expect(beatsPerBarOf('nonsense')).toBe(4);
  });

  it('ME-07 reports the bar length a `//n` tag is measured in', () => {
    expect(beatsPerBarOf('6/8')).toBe(6);
    expect(beatsPerBarOf('3/4')).toBe(3);
    expect(beatsPerBarOf('7/8')).toBe(7);
  });
});
