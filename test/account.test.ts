import { describe, expect, it } from 'vitest';
import { accountAction, accountState } from '../src/lib/account';

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

describe('accountAction', () => {
  it('AC-03 offers the way out as well as the way in', () => {
    // The header carries the action in both directions; the footer only ever states a fact.
    expect(accountAction('signed-in')?.label).toBe('Sign out');
    expect(accountAction('signed-out')?.label).toBe('Sign in');
  });

  it('AC-04 offers nothing while there is nothing to offer', () => {
    expect(accountAction('checking')).toBeNull();
    expect(accountAction('unavailable')).toBeNull();
  });

  it('AC-05 signing in is worded, signing out is an icon', () => {
    // An invitation needs its words; a utility you already know the shape of does not, and a word
    // for it would weigh as much as the app's own name beside it.
    expect(accountAction('signed-out')?.kind).toBe('sign-in');
    expect(accountAction('signed-in')?.kind).toBe('sign-out');
  });
});
