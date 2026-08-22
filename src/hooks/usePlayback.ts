/**
 * Drives a schedule with a wall-clock timer.
 *
 * This is the only place that knows time is passing. All the arithmetic lives in
 * `lib/playback.ts`; swapping this clock for an audio element's `currentTime` later would not
 * touch that module (ADR-003).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isComplete, rowIndexAt, totalDurationMs, type ScheduleEntry } from '../lib/playback';

export interface PlaybackController {
  isPlaying: boolean;
  elapsedMs: number;
  totalMs: number;
  /** Index of the active row, or -1 when stopped at the end. */
  activeIndex: number;
  finished: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  restart(): void;
  seekToRow(index: number): void;
}

export function usePlayback(
  schedule: ScheduleEntry[],
  onComplete?: () => void
): PlaybackController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

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
    if (!isPlaying) return undefined;

    const origin = performance.now() - elapsedRef.current;
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

  const play = useCallback(() => {
    // Pressing play at the end starts the next run rather than doing nothing.
    if (isComplete(scheduleRef.current, elapsedRef.current)) setElapsed(0);
    setIsPlaying(true);
  }, [setElapsed]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const toggle = useCallback(() => {
    setIsPlaying((playing) => {
      if (playing) return false;
      if (isComplete(scheduleRef.current, elapsedRef.current)) setElapsed(0);
      return true;
    });
  }, [setElapsed]);

  const restart = useCallback(() => {
    setElapsed(0);
    setIsPlaying(false);
  }, [setElapsed]);

  const seekToRow = useCallback(
    (index: number) => {
      const entry = scheduleRef.current[index];
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
    play,
    pause,
    toggle,
    restart,
    seekToRow,
  };
}
