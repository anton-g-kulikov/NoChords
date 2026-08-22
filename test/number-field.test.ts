import { describe, expect, it } from 'vitest';
import { commitValue } from '../src/lib/numberField';

describe('commitValue', () => {
  it('NF-01 commits a valid in-range number', () => {
    expect(commitValue('80', 20, 300)).toBe(80);
    expect(commitValue('12', 1, 64)).toBe(12);
  });

  it('NF-02 commits nothing for an empty field', () => {
    // The regression this exists for: an emptied field used to restore the old value on the very
    // keystroke that cleared it, so 90 could become 9 but never 80.
    expect(commitValue('', 20, 300)).toBeNull();
  });

  it('NF-03 commits nothing for whitespace alone', () => {
    expect(commitValue('   ', 20, 300)).toBeNull();
  });

  it('NF-04 commits nothing below the minimum', () => {
    // `8` is what you pass through on the way to `80`; storing 8 would be wrong.
    expect(commitValue('8', 20, 300)).toBeNull();
    expect(commitValue('19', 20, 300)).toBeNull();
  });

  it('NF-05 commits nothing above the maximum', () => {
    expect(commitValue('301', 20, 300)).toBeNull();
    expect(commitValue('99999', 0, 16)).toBeNull();
  });

  it('NF-06 allows the bounds themselves', () => {
    expect(commitValue('20', 20, 300)).toBe(20);
    expect(commitValue('300', 20, 300)).toBe(300);
    expect(commitValue('0', 0, 16)).toBe(0);
  });

  it('NF-07 commits nothing for text that is not a number', () => {
    expect(commitValue('abc', 20, 300)).toBeNull();
    expect(commitValue('8o', 20, 300)).toBeNull();
    expect(commitValue('-', 20, 300)).toBeNull();
    expect(commitValue('1e3', 20, 300)).toBeNull();
  });

  it('NF-08 waits for a decimal to be finished', () => {
    expect(commitValue('1.', 0, 16)).toBeNull();
    expect(commitValue('1.5', 0, 16)).toBe(1.5);
  });

  it('NF-09 reads leading zeros and surrounding spaces as the number they are', () => {
    expect(commitValue('080', 20, 300)).toBe(80);
    expect(commitValue(' 80 ', 20, 300)).toBe(80);
  });

  it('NF-10 commits a negative only where the minimum allows it', () => {
    expect(commitValue('-5', 0, 16)).toBeNull();
    expect(commitValue('-5', -10, 16)).toBe(-5);
  });
});
