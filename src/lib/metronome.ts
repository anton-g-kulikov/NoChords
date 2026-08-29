/**
 * Metronome timing.
 *
 * Pure arithmetic over beats: which beats fall in a stretch of time, and which of them are
 * accented. The audio itself lives in `hooks/useMetronome.ts`; keeping the maths here means the
 * scheduler's correctness — every beat once, none twice — is unit-testable without sound.
 *
 * Beat 0 is the first beat of the song. The count-in runs at negative indices (ADR-015).
 */
import type { ScheduleEntry } from './playback';

/** Where the accent falls when a meter cannot say: the first beat of a bar of four. */
const DEFAULT_ACCENT_EVERY = 4;

/** A beat to play: its index on the song's beat clock, and when it falls. */
export interface ScheduledBeat {
  index: number;
  /** Milliseconds from the song's first beat; negative during the count-in. */
  atMs: number;
}

/** How long the count-in lasts, at the length of one beat of the opening meter. */
export function countInDurationMs(beatMs: number, countInBeats: number): number {
  return Math.max(0, countInBeats) * Math.max(beatMs, 0);
}

/**
 * When to fire a click so that it is *heard* on the beat.
 *
 * A click scheduled at audio time T reaches the speaker at T + the output latency, which on a
 * phone is routinely a tenth of a second and over Bluetooth far more. Uncompensated, every click
 * lands late against a screen that has no such delay — at 90bpm, a typical Android latency is
 * half a beat, which is exactly what it sounds like (ADR-030).
 *
 * Times are in seconds, matching the audio clock; `beatElapsedMs` is in milliseconds, matching
 * everything else in the app.
 */
export function clickAt(
  audioOriginSec: number,
  beatElapsedMs: number,
  outputLatencySec: number
): number {
  return audioOriginSec + beatElapsedMs / 1000 - Math.max(outputLatencySec, 0);
}

/**
 * Beats whose time falls in `[fromMs, toMs)`, taken from the schedule itself.
 *
 * The times come from each row's own window rather than from one beat length for the whole song,
 * because a beat is not a fixed length any more: with the tempo pinned to a note value, a `{3/4}`
 * section counts quarters where the 6/8 around it counts eighths, and the two are not the same
 * duration (ADR-052). Reading the schedule keeps the clicks on the rows they belong to.
 *
 * The window is half-open on purpose: a beat landing exactly on a boundary belongs to the later
 * window only, so scanning forward in slices plays every beat once and none twice.
 */
export function beatsInWindow(
  schedule: ScheduleEntry[],
  countInBeatMs: number,
  fromMs: number,
  toMs: number
): ScheduledBeat[] {
  if (!(toMs > fromMs)) return [];
  const beats: ScheduledBeat[] = [];

  // The count-in runs at negative indices, on the pulse of the meter the song opens in.
  const leadBeat = schedule.length > 0 ? entryBeatMs(schedule[0]) : Math.max(countInBeatMs, 0);
  const leadEnd = Math.min(toMs, 0);
  if (leadBeat > 0) {
    for (let index = Math.ceil(fromMs / leadBeat); index * leadBeat < leadEnd; index += 1) {
      beats.push({ index, atMs: index * leadBeat });
    }
  }

  for (const entry of schedule) {
    if (entry.endMs <= fromMs) continue;
    if (entry.startMs >= toMs) break;

    const beatMs = entryBeatMs(entry);
    for (let offset = 0; offset < entry.beats; offset += 1) {
      const atMs = entry.startMs + offset * beatMs;
      if (atMs < fromMs || atMs >= toMs) continue;
      beats.push({ index: entry.startBeat + offset, atMs });
    }
  }

  return beats;
}

/** Length of one beat inside a row: its window divided by the beats it holds. */
function entryBeatMs(entry: ScheduleEntry): number {
  return entry.durationMs / Math.max(entry.beats, 1);
}

/**
 * Whether a beat carries the accent, given how often the accent falls and where the current
 * section began. A nonsensical spacing degrades to a plain 4/4 accent rather than accenting
 * every beat.
 */
export function isAccent(beatIndex: number, accentEvery: number, sectionStartBeat = 0): boolean {
  const per = accentEvery > 0 ? Math.round(accentEvery) : DEFAULT_ACCENT_EVERY;
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
  if (schedule.length === 0) return isAccent(beatIndex, DEFAULT_ACCENT_EVERY);
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
