import { describe, expect, it } from 'vitest';
import { claimPlaybackSession } from '../src/lib/audioSession';

describe('claimPlaybackSession', () => {
  it('AS-01 declares audio as playback where the browser has an audio session', () => {
    // Which is what stops the iPhone's silent switch muting a metronome (ADR-066).
    const navigatorLike = { audioSession: { type: 'auto' } };
    expect(claimPlaybackSession(navigatorLike)).toBe(true);
    expect(navigatorLike.audioSession.type).toBe('playback');
  });

  it('AS-02 says nothing where there is nothing to say it to', () => {
    expect(claimPlaybackSession({})).toBe(false);
    expect(claimPlaybackSession(undefined)).toBe(false);
    expect(claimPlaybackSession(null)).toBe(false);
  });

  it('AS-03 survives a browser that exposes the property and refuses the value', () => {
    const stubborn = { audioSession: {} };
    Object.defineProperty(stubborn.audioSession, 'type', {
      get: () => 'auto',
      set: () => {
        throw new Error('nope');
      },
    });
    expect(claimPlaybackSession(stubborn)).toBe(false);
  });
});
