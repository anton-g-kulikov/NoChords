/**
 * Telling iOS that the metronome is music, not a sound effect (ADR-066).
 *
 * Safari plays Web Audio in an "ambient" category by default, and ambient audio is what the ring/
 * silent switch silences. A metronome you deliberately pressed play on is not a notification chirp:
 * it should behave like a media player, which keeps sounding with the switch flipped. Safari 16.4
 * added `navigator.audioSession` to say so.
 *
 * Everywhere else this is absent and nothing needs saying, so a missing API is not a failure.
 */

interface AudioSessionHolder {
  audioSession?: { type?: string };
}

/**
 * Declares audio as playback, returning whether the browser understood.
 *
 * Takes the navigator rather than reaching for the global, so the branch can be tested both ways.
 */
export function claimPlaybackSession(navigatorLike: unknown): boolean {
  const holder = navigatorLike as AudioSessionHolder | null | undefined;
  const session = holder?.audioSession;
  if (!session || typeof session !== 'object') return false;

  try {
    session.type = 'playback';
    return session.type === 'playback';
  } catch {
    // A browser that exposes the property but refuses the value: nothing to do about it.
    return false;
  }
}
