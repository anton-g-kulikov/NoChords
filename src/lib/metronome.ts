/**
 * Metronome timing.
 *
 * Pure arithmetic over beats: which beats fall in a stretch of time, and which of them are
 * accented. The audio itself lives in `hooks/useMetronome.ts`; keeping the maths here means the
 * scheduler's correctness — every beat once, none twice — is unit-testable without sound.
 *
 * Beat 0 is the first beat of the song. The count-in runs at negative indices (ADR-015).
 */
import { DEFAULT_BEATS_PER_LINE, MIN_TEMPO } from './playback';

/** Length of one beat at a tempo, floored so a nonsensical tempo cannot divide by zero. */
export function beatDurationMs(tempo: number): number {
  return 60000 / Math.max(tempo, MIN_TEMPO);
}

/** How long the count-in lasts. */
export function countInDurationMs(tempo: number, countInBeats: number): number {
  return Math.max(0, countInBeats) * beatDurationMs(tempo);
}

/**
 * Beat indices whose time falls in `[fromMs, toMs)`.
 *
 * The window is half-open on purpose: a beat landing exactly on a boundary belongs to the later
 * window only, so scanning forward in slices plays every beat once and none twice.
 */
export function beatsInWindow(tempo: number, fromMs: number, toMs: number): number[] {
  if (!(toMs > fromMs)) return [];

  const beat = beatDurationMs(tempo);
  const first = Math.ceil(fromMs / beat);
  const beats: number[] = [];

  for (let index = first; index * beat < toMs; index += 1) {
    beats.push(index);
  }
  return beats;
}

/**
 * Whether a beat opens a line, and so takes the accented click.
 * A nonsensical line length degrades to a plain 4/4 accent rather than accenting every beat.
 */
export function isAccent(beatIndex: number, beatsPerLine: number): boolean {
  const per = beatsPerLine > 0 ? Math.round(beatsPerLine) : DEFAULT_BEATS_PER_LINE;
  return (((beatIndex % per) + per) % per) === 0;
}
