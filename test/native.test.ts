import { afterEach, describe, expect, it } from 'vitest';
import { isCancelledSignIn, isNative } from '../src/lib/native';

type WithBridge = { Capacitor?: unknown };

describe('isNative', () => {
  afterEach(() => {
    delete (globalThis as WithBridge).Capacitor;
  });

  it('NA-01 is true inside a shell that says it is native', () => {
    (globalThis as WithBridge).Capacitor = { isNativePlatform: () => true };
    expect(isNative()).toBe(true);
  });

  it('NA-02 is false in a browser, where there is no bridge at all', () => {
    expect(isNative()).toBe(false);
  });

  it('NA-03 is false for a bridge that reports the web platform, or is not a bridge', () => {
    // `@capacitor/core` installs a web stand-in on the same global when it is imported in a browser.
    (globalThis as WithBridge).Capacitor = { isNativePlatform: () => false };
    expect(isNative()).toBe(false);
    (globalThis as WithBridge).Capacitor = {};
    expect(isNative()).toBe(false);
  });
});

describe('isCancelledSignIn', () => {
  it('NA-04 recognises each platform backing out of Google sign-in', () => {
    expect(isCancelledSignIn(new Error('The user canceled the sign-in flow.'))).toBe(true);
    expect(isCancelledSignIn(new Error('Authorization canceled.'))).toBe(true);
    expect(isCancelledSignIn({ message: 'activity is cancelled by the user.' })).toBe(true);
  });

  it('NA-05 leaves real failures as failures', () => {
    expect(isCancelledSignIn(new Error('A network error has occurred.'))).toBe(false);
    expect(isCancelledSignIn(new Error('No credentials available'))).toBe(false);
    expect(isCancelledSignIn(null)).toBe(false);
    expect(isCancelledSignIn('cancel')).toBe(false);
  });
});
