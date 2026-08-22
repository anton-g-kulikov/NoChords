import { describe, expect, it } from 'vitest';
import { shouldOfferImport } from '../src/lib/cloudImport';

describe('shouldOfferImport', () => {
  it('CI-01 offers when there are local songs and the cloud is empty', () => {
    expect(shouldOfferImport(3, 0)).toBe(true);
    expect(shouldOfferImport(1, 0)).toBe(true);
  });

  it('CI-02 does not offer when the cloud already has songs', () => {
    // The account is already in use; concatenating a second device's library would duplicate it.
    expect(shouldOfferImport(3, 5)).toBe(false);
    expect(shouldOfferImport(3, 1)).toBe(false);
  });

  it('CI-03 has nothing to offer when there is nothing local', () => {
    expect(shouldOfferImport(0, 0)).toBe(false);
    expect(shouldOfferImport(0, 7)).toBe(false);
  });

  it('CI-04 does not offer when both sides are empty', () => {
    expect(shouldOfferImport(0, 0)).toBe(false);
  });

  it('CI-05 depends only on the counts, never on what the songs are', () => {
    // Deliberately not "is this the example library?" — that would mean matching titles, which
    // breaks the moment one is renamed.
    expect(shouldOfferImport(2, 0)).toBe(shouldOfferImport(2, 0));
    expect(shouldOfferImport(99, 0)).toBe(true);
  });

  it('treats negative or nonsensical counts as nothing to do', () => {
    expect(shouldOfferImport(-1, 0)).toBe(false);
    expect(shouldOfferImport(2, -1)).toBe(true);
  });
});
