import { describe, expect, it } from 'vitest';
import { isAwaitingAccount } from '../src/lib/library';

describe('isAwaitingAccount', () => {
  it('LB-01 waits while the sign-in check is still running', () => {
    // Nobody is signed in *yet* — which is not the same as nobody being signed in.
    expect(isAwaitingAccount(true, null, false)).toBe(true);
    expect(isAwaitingAccount(true, null, true)).toBe(true);
  });

  it('LB-02 waits for a signed-in account’s store to answer', () => {
    expect(isAwaitingAccount(false, 'uid-1', false)).toBe(true);
    expect(isAwaitingAccount(false, 'uid-1', true)).toBe(false);
  });

  it('LB-03 shows the device library as soon as it is known there is no account', () => {
    expect(isAwaitingAccount(false, null, true)).toBe(false);
    // Resolved to no account is the same answer whichever way the store flag reads.
    expect(isAwaitingAccount(false, null, false)).toBe(false);
  });
});
