/**
 * The audible metronome.
 *
 * Clicks are scheduled ahead onto the audio clock rather than fired from the frame loop, so they
 * stay steady when rendering stutters (ADR-014). All the beat arithmetic is in `lib/metronome.ts`;
 * this hook only owns the `AudioContext` and the lookahead loop.
 */
import { useCallback, useEffect, useRef } from 'react';
import { accentAt, beatsInWindow, clickAt } from '../lib/metronome';
import type { ScheduleEntry } from '../lib/playback';

/** How often the scheduler wakes. Short enough to be responsive, long enough to be cheap. */
const TICK_MS = 25;

/**
 * How late a click may be and still be worth playing, in milliseconds.
 *
 * The first scan of a run cannot happen before the run starts, so the click that lands exactly on
 * the start is always a hair late. Playing it immediately is right; a click late by more than this
 * belongs to a stretch that has already gone by — after a seek — and playing it would flam.
 */
const LATE_TOLERANCE_MS = 60;

/** How far ahead each wake schedules. Comfortably longer than a tick's worst-case delay. */
const LOOKAHEAD_MS = 150;

const ACCENT_HZ = 1600;
const BEAT_HZ = 900;
const CLICK_SECONDS = 0.04;

export interface MetronomeOptions {
  enabled: boolean;
  /** 0..1. */
  volume: number;
  /** Length of one beat of the song's opening meter, which the count-in runs on (ADR-052). */
  beatMs: number;
  /** The song's schedule, which carries the meter running at each beat (ADR-026). */
  schedule: ScheduleEntry[];
  isPlaying: boolean;
  /**
   * `performance.now()` value corresponding to elapsed time zero — the song's first beat.
   * Negative elapsed before it is the count-in. `null` when playback is stopped.
   */
  originMs: number | null;
  /** Length of the song in milliseconds; clicking stops at the end. */
  totalMs: number;
}

export function useMetronome({
  enabled,
  volume,
  beatMs,
  schedule,
  isPlaying,
  originMs,
  totalMs,
}: MetronomeOptions): void {
  const contextRef = useRef<AudioContext | null>(null);
  /** Seconds between scheduling a sound and hearing it. Fixed once per run, with the origin. */
  const latencyRef = useRef(0);
  // Where the last scan stopped, in elapsed milliseconds, so windows stay contiguous.
  const scannedToRef = useRef<number | null>(null);
  /**
   * Audio-clock time corresponding to elapsed zero, fixed once when playback starts.
   *
   * Every click is derived from this single anchor. Re-reading `performance.now()` against
   * `AudioContext.currentTime` on each scheduler tick would give each click its own pinning error
   * — measured at nearly 2ms of beat-to-beat jitter, which is avoidable.
   */
  const audioOriginRef = useRef<number | null>(null);

  const latest = useRef({ volume, beatMs, schedule, originMs, totalMs });
  useEffect(() => {
    latest.current = { volume, beatMs, schedule, originMs, totalMs };
  }, [volume, beatMs, schedule, originMs, totalMs]);

  /** One click, scheduled at an absolute time on the audio clock. */
  const scheduleClick = useCallback((context: AudioContext, at: number, accent: boolean) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = accent ? ACCENT_HZ : BEAT_HZ;
    oscillator.type = 'square';

    // A short exponential decay reads as a click; a bare gate would pop.
    const peak = Math.max(0.0001, latest.current.volume * (accent ? 0.5 : 0.32));
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + CLICK_SECONDS);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + CLICK_SECONDS + 0.01);
  }, []);

  useEffect(() => {
    if (!enabled || !isPlaying || originMs === null) {
      scannedToRef.current = null;
      return undefined;
    }

    let context = contextRef.current;
    if (!context) {
      try {
        context = new AudioContext();
        contextRef.current = context;
      } catch {
        // No Web Audio here; the app stays silent rather than breaking.
        return undefined;
      }
    }
    // Browsers start the context suspended until a gesture; play() is that gesture.
    void context.resume().catch(() => {});
    audioOriginRef.current = null;

    // Start scanning from the beat boundary at or before this run began, not from whenever the
    // first tick happens to land. Otherwise the opening click — the "one" of the count-in — falls
    // into the gap before the first scan and the count comes in on two.
    const runStart = performance.now() - originMs;
    scannedToRef.current = Math.floor(runStart / beatMs) * beatMs;

    const timer = window.setInterval(() => {
      const ctx = contextRef.current;
      if (!ctx || ctx.state !== 'running') return;

      const current = latest.current;
      if (current.originMs === null) return;

      const elapsed = performance.now() - current.originMs;

      // Pin the two clocks to each other exactly once, on the first tick of this run.
      if (audioOriginRef.current === null) {
        audioOriginRef.current = ctx.currentTime - elapsed / 1000;
        // `outputLatency` is what the device actually adds; `baseLatency` is only the graph's own
        // buffering, and is the honest fallback where the browser does not report the rest.
        const withLatency = ctx as AudioContext & { outputLatency?: number };
        latencyRef.current = withLatency.outputLatency || ctx.baseLatency || 0;
      }
      const audioOrigin = audioOriginRef.current;
      const latency = latencyRef.current;

      const from = scannedToRef.current ?? elapsed;
      // Compensation pulls every click earlier, so the window must reach past it or the clicks
      // would be scheduled in their own past and clamped back to late.
      const to = elapsed + LOOKAHEAD_MS + latency * 1000;
      scannedToRef.current = to;

      for (const { index, atMs } of beatsInWindow(current.schedule, current.beatMs, from, to)) {
        // Stop at the end of the song; the count-in beats before zero still play.
        if (atMs >= current.totalMs) continue;
        const at = clickAt(audioOrigin, atMs, latency);
        const lateByMs = (ctx.currentTime - at) * 1000;
        if (lateByMs > LATE_TOLERANCE_MS) continue;
        // A click a few milliseconds late still belongs at the top of the count: play it now
        // rather than dropping it, which is what silenced the first count-in beat.
        scheduleClick(ctx, Math.max(at, ctx.currentTime), accentAt(index, current.schedule));
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
      scannedToRef.current = null;
      audioOriginRef.current = null;
    };
  }, [enabled, isPlaying, originMs, beatMs, scheduleClick]);

  // Release the audio device when the player goes away.
  useEffect(
    () => () => {
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    },
    []
  );
}
