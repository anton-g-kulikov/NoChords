import { describe, expect, it } from 'vitest';
import { installAffordance, isIos } from '../src/lib/install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

describe('isIos', () => {
  it('IS-01 recognises an iPhone and an iPad', () => {
    expect(isIos(IPHONE)).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)')).toBe(true);
  });

  it('IS-02 does not mistake Android or a desktop for iOS', () => {
    expect(isIos(ANDROID)).toBe(false);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
    expect(isIos('')).toBe(false);
  });
});

describe('installAffordance', () => {
  it('IS-03 offers a button once the browser hands over a prompt', () => {
    expect(installAffordance({ standalone: false, promptAvailable: true, ios: false })).toBe(
      'prompt'
    );
  });

  it('IS-04 tells iOS where its own button is, since there is no API', () => {
    expect(installAffordance({ standalone: false, promptAvailable: false, ios: true })).toBe(
      'ios-share'
    );
  });

  it('IS-05 **offers nothing to an app already installed**', () => {
    // Whatever else is true: inviting someone to install what they are running is nonsense.
    expect(installAffordance({ standalone: true, promptAvailable: true, ios: false })).toBe('none');
    expect(installAffordance({ standalone: true, promptAvailable: false, ios: true })).toBe('none');
  });

  it('IS-06 stays quiet in a browser that has not offered anything', () => {
    // Desktop Firefox, an in-app browser, or Chrome before it decides the app qualifies.
    expect(installAffordance({ standalone: false, promptAvailable: false, ios: false })).toBe(
      'none'
    );
  });
});
