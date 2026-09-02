import { describe, expect, it } from 'vitest';
import { accountActionLabel, accountState } from '../src/lib/account';

describe('accountState', () => {
  it('AC-01 reads the auth controller as one of four states', () => {
    expect(accountState(true, false, true)).toBe('signed-in');
    expect(accountState(true, false, false)).toBe('signed-out');
    expect(accountState(true, true, false)).toBe('checking');
    expect(accountState(false, false, false)).toBe('unavailable');
  });

  it('AC-02 answers "unavailable" before anything else', () => {
    // No Firebase means no account, whatever the other flags happen to say.
    expect(accountState(false, true, true)).toBe('unavailable');
  });
});

describe('accountActionLabel', () => {
  it('AC-03 offers the way out as well as the way in', () => {
    // The header carries the action in both directions; the footer only ever states a fact.
    expect(accountActionLabel('signed-in')).toBe('Sign out');
    expect(accountActionLabel('signed-out')).toBe('Sign in');
  });

  it('AC-04 offers nothing while there is nothing to offer', () => {
    expect(accountActionLabel('checking')).toBeNull();
    expect(accountActionLabel('unavailable')).toBeNull();
  });
});
