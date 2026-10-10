import { describe, expect, it } from 'vitest';
import {
  accountAction,
  accountState,
  signInErrorMessage,
  signInProviders,
} from '../src/lib/account';

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

describe('signInProviders', () => {
  it('AC-06 offers Apple first, then Google, in the iOS app', () => {
    // App Review requires Apple beside Google there, and no less prominent (ADR-103).
    expect(signInProviders('ios')).toEqual(['apple', 'google']);
  });

  it('AC-07 offers only Google on the web and Android, where Apple is not set up', () => {
    expect(signInProviders('web')).toEqual(['google']);
    expect(signInProviders('android')).toEqual(['google']);
  });
});

describe('signInErrorMessage', () => {
  it('AC-08 says nothing when someone backs out', () => {
    expect(signInErrorMessage('auth/popup-closed-by-user', 'google')).toBeNull();
    expect(signInErrorMessage('auth/cancelled-popup-request', 'apple')).toBeNull();
  });

  it('AC-09 points an email that has an account elsewhere at the other provider', () => {
    const code = 'auth/account-exists-with-different-credential';
    expect(signInErrorMessage(code, 'apple')).toMatch(/through Google\. Sign in with Google/);
    expect(signInErrorMessage(code, 'google')).toMatch(/through Apple\. Sign in with Apple/);
  });

  it('AC-10 keeps the popup advice and falls back to a plain failure', () => {
    expect(signInErrorMessage('auth/popup-blocked', 'google')).toMatch(/Allow pop-ups/);
    expect(signInErrorMessage('auth/network-request-failed', 'google')).toMatch(/Sign-in failed/);
    expect(signInErrorMessage('', 'google')).toMatch(/Sign-in failed/);
  });

  it('AC-11 sends a failed Apple sign-in to the Apple Account in Settings', () => {
    // Apple's error 1000, what closing iOS's "sign in to your Apple Account" prompt returns.
    expect(signInErrorMessage('', 'apple')).toMatch(/signed in to an Apple Account/);
  });
});
