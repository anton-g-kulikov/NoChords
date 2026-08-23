/**
 * Drives a schedule with a wall-clock timer.
 *
 * This is the only place that knows time is passing. All the arithmetic lives in
 * `lib/playback.ts`; swapping this clock for an audio element's `currentTime` later would not
 * touch that module (ADR-003).
 *
 * A count-in is simply negative elapsed time: play starts the clock at `-countInMs` and the song
 * proper begins as it crosses zero (ADR-015).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  entryForRow,
  isComplete,
  rowIndexAt,
  totalDurationMs,
  type ScheduleEntry,
} from '../lib/playback';

export interface PlaybackController {
  isPlaying: boolean;
  /** Negative while counting in. */
  elapsedMs: number;
  totalMs: number;
  /** Index of the active row, or -1 when stopped at the end. */
  activeIndex: number;
  finished: boolean;
  /** True while the count-in is running. */
  countingIn: boolean;
  /** Beats still to count, 1..n, or 0 when not counting in. */
  countInRemaining: number;
  /**
   * `performance.now()` at elapsed zero, or `null` when stopped. The metronome pins its audio
   * clock to this so the clicks and the scroll share one timeline.
   */
  originMs: number | null;
  play(): void;
  pause(): void;
  toggle(): void;
  restart(): void;
  seekToRow(index: number): void;
}

/**
 * How long after pressing play everything actually begins (ADR-030).
 *
 * The opening click has to be scheduled before it sounds, and latency compensation asks for it
 * earlier still — both impossible if the timeline starts at the very instant of the press, which
 * left the first click clamped and late. Starting a fraction of a second later gives the scheduler
 * that room. It shifts the countdown by the same amount, so nothing drifts apart, and a quarter of
 * a second before a count-in reads as nothing at all.
 */
const LEAD_IN_MS = 250;

export interface PlaybackOptions {
  /** Length of the count-in before the song starts. */
  countInMs?: number;
  /** Length of one beat, used only to count the count-in down on screen. */
  beatMs?: number;
  onComplete?: () => void;
}

export function usePlayback(
  schedule: ScheduleEntry[],
  { countInMs = 0, beatMs = 0, onComplete }: PlaybackOptions = {}
): PlaybackController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [originMs, setOriginMs] = useState<number | null>(null);

  const elapsedRef = useRef(0);
  const scheduleRef = useRef(schedule);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const setElapsed = useCallback((ms: number) => {
    elapsedRef.current = ms;
    setElapsedMs(ms);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setOriginMs(null);
      return undefined;
    }

    const origin = performance.now() + LEAD_IN_MS - elapsedRef.current;
    setOriginMs(origin);
    let frame = 0;

    const tick = () => {
      const total = totalDurationMs(scheduleRef.current);
      const next = performance.now() - origin;

      if (scheduleRef.current.length > 0 && next >= total) {
        setElapsed(total);
        setIsPlaying(false);
        onCompleteRef.current?.();
        return;
      }

      setElapsed(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, setElapsed]);

  const totalMs = useMemo(() => totalDurationMs(schedule), [schedule]);
  const finished = isComplete(schedule, elapsedMs);
  const activeIndex = rowIndexAt(schedule, elapsedMs);
  const countingIn = isPlaying && elapsedMs < 0;
  // Capped at the length of the count-in: during the lead-in the clock has not reached the first
  // beat yet, and the raw arithmetic would flash a number that is not part of the count.
  const countInRemaining =
    countingIn && beatMs > 0
      ? Math.min(Math.ceil(-elapsedMs / beatMs), Math.ceil(countInMs / beatMs))
      : 0;

  /** Starts from the count-in, or from the top if the song has already finished. */
  const startFrom = useCallback(
    (fromMs: number) => {
      setElapsed(fromMs);
      setIsPlaying(true);
    },
    [setElapsed]
  );

  const play = useCallback(() => {
    const atEnd = isComplete(scheduleRef.current, elapsedRef.current);
    // Count in before the top of the song, but not when resuming from a pause mid-song.
    const resuming = !atEnd && elapsedRef.current > 0;
    startFrom(resuming ? elapsedRef.current : -countInMs);
  }, [countInMs, startFrom]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    play();
  }, [isPlaying, play]);

  const restart = useCallback(() => {
    setElapsed(0);
    setIsPlaying(false);
  }, [setElapsed]);

  const seekToRow = useCallback(
    (index: number) => {
      // By row index, not schedule position: blank rows have no entry, so the two differ (ADR-025).
      const entry = entryForRow(scheduleRef.current, index);
      if (entry) setElapsed(entry.startMs);
    },
    [setElapsed]
  );

  return {
    isPlaying,
    elapsedMs,
    totalMs,
    activeIndex,
    finished,
    countingIn,
    countInRemaining,
    originMs,
    play,
    pause,
    toggle,
    restart,
    seekToRow,
  };
}
