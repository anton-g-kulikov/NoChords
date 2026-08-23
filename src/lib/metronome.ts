/**
 * Metronome timing.
 *
 * Pure arithmetic over beats: which beats fall in a stretch of time, and which of them are
 * accented. The audio itself lives in `hooks/useMetronome.ts`; keeping the maths here means the
 * scheduler's correctness — every beat once, none twice — is unit-testable without sound.
 *
 * Beat 0 is the first beat of the song. The count-in runs at negative indices (ADR-015).
 */
import { DEFAULT_BEATS_PER_LINE, MIN_TEMPO, type ScheduleEntry } from './playback';

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
 * Whether a beat carries the accent, given how often the accent falls and where the current
 * section began. A nonsensical spacing degrades to a plain 4/4 accent rather than accenting
 * every beat.
 */
export function isAccent(beatIndex: number, accentEvery: number, sectionStartBeat = 0): boolean {
  const per = accentEvery > 0 ? Math.round(accentEvery) : DEFAULT_BEATS_PER_LINE;
  const offset = beatIndex - sectionStartBeat;
  return (((offset % per) + per) % per) === 0;
}

/**
 * Whether a beat of this song carries the accent.
 *
 * The pulse comes from the meter running at that beat, so a `{4/4}` bridge inside a 6/8 song
 * clicks in four while it lasts and the phase restarts where the signature changed (ADR-026).
 * Count-in beats run at negative indices, before any section: they take the opening meter, phased
 * so that beat 0 — the downbeat the count-in is leading to — lands on an accent.
 */
export function accentAt(beatIndex: number, schedule: ScheduleEntry[]): boolean {
  if (schedule.length === 0) return isAccent(beatIndex, DEFAULT_BEATS_PER_LINE);
  if (beatIndex < 0) return isAccent(beatIndex, schedule[0].accentEvery);

  // The last entry whose section has started by this beat; the song's own beat clock is
  // monotonic, so scanning forward is enough.
  let current = schedule[0];
  for (const entry of schedule) {
    if (entry.startBeat > beatIndex) break;
    current = entry;
  }
  return isAccent(beatIndex, current.accentEvery, current.sectionStartBeat);
}
