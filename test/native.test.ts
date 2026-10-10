import { afterEach, describe, expect, it } from 'vitest';
import { isCancelledSignIn, isNative, nativePlatform, setPageChrome } from '../src/lib/native';

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
    // Apple names no cancel, only its number.
    const apple =
      'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)';
    expect(isCancelledSignIn(new Error(apple))).toBe(true);
  });

  it('NA-05 leaves real failures as failures', () => {
    expect(isCancelledSignIn(new Error('A network error has occurred.'))).toBe(false);
    expect(isCancelledSignIn(new Error('No credentials available'))).toBe(false);
    expect(isCancelledSignIn(null)).toBe(false);
    expect(isCancelledSignIn('cancel')).toBe(false);
    // Apple's other failures carry other numbers.
    const failed = '(com.apple.AuthenticationServices.AuthorizationError error 1000.)';
    expect(isCancelledSignIn(new Error(failed))).toBe(false);
    expect(isCancelledSignIn(new Error('AuthorizationError error 10010'))).toBe(false);
  });
});

describe('nativePlatform', () => {
  afterEach(() => {
    delete (globalThis as WithBridge).Capacitor;
  });

  it('NA-06 names the shell it is running in', () => {
    (globalThis as WithBridge).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    expect(nativePlatform()).toBe('ios');
    (globalThis as WithBridge).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
    expect(nativePlatform()).toBe('android');
  });

  it('NA-07 is web in a browser, and for anything it does not recognise', () => {
    expect(nativePlatform()).toBe('web');
    (globalThis as WithBridge).Capacitor = { isNativePlatform: () => false, getPlatform: () => 'ios' };
    expect(nativePlatform()).toBe('web');
    (globalThis as WithBridge).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'tv' };
    expect(nativePlatform()).toBe('web');
  });
});

describe('setPageChrome', () => {
  afterEach(() => {
    delete (globalThis as WithBridge).Capacitor;
  });

  function shell() {
    const calls: unknown[][] = [];
    (globalThis as WithBridge).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      nativePromise: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve();
      },
    };
    return calls;
  }

  it('NA-08 tells the shell the page colour and whether it is dark', () => {
    const calls = shell();
    setPageChrome('dark');
    setPageChrome('light');
    expect(calls).toEqual([
      ['PageChrome', 'setTheme', { color: '#15120e', dark: true }],
      ['PageChrome', 'setTheme', { color: '#f4efe6', dark: false }],
    ]);
  });

  it('NA-09 does nothing in a browser, and survives a shell without the plugin', async () => {
    expect(() => setPageChrome('dark')).not.toThrow();
    (globalThis as WithBridge).Capacitor = {
      isNativePlatform: () => true,
      nativePromise: () => Promise.reject(new Error('"PageChrome" plugin is not implemented')),
    };
    expect(() => setPageChrome('light')).not.toThrow();
    // Let the rejection settle: an unhandled one would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
