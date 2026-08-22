/**
 * The audible metronome.
 *
 * Clicks are scheduled ahead onto the audio clock rather than fired from the frame loop, so they
 * stay steady when rendering stutters (ADR-014). All the beat arithmetic is in `lib/metronome.ts`;
 * this hook only owns the `AudioContext` and the lookahead loop.
 */
import { useCallback, useEffect, useRef } from 'react';
import { beatDurationMs, beatsInWindow, isAccent } from '../lib/metronome';

/** How often the scheduler wakes. Short enough to be responsive, long enough to be cheap. */
const TICK_MS = 25;

/** How far ahead each wake schedules. Comfortably longer than a tick's worst-case delay. */
const LOOKAHEAD_MS = 150;

const ACCENT_HZ = 1600;
const BEAT_HZ = 900;
const CLICK_SECONDS = 0.04;

export interface MetronomeOptions {
  enabled: boolean;
  /** 0..1. */
  volume: number;
  tempo: number;
  beatsPerLine: number;
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
  tempo,
  beatsPerLine,
  isPlaying,
  originMs,
  totalMs,
}: MetronomeOptions): void {
  const contextRef = useRef<AudioContext | null>(null);
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

  const latest = useRef({ volume, tempo, beatsPerLine, originMs, totalMs });
  useEffect(() => {
    latest.current = { volume, tempo, beatsPerLine, originMs, totalMs };
  }, [volume, tempo, beatsPerLine, originMs, totalMs]);

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

    const timer = window.setInterval(() => {
      const ctx = contextRef.current;
      if (!ctx || ctx.state !== 'running') return;

      const current = latest.current;
      if (current.originMs === null) return;

      const elapsed = performance.now() - current.originMs;

      // Pin the two clocks to each other exactly once, on the first tick of this run.
      if (audioOriginRef.current === null) {
        audioOriginRef.current = ctx.currentTime - elapsed / 1000;
      }
      const audioOrigin = audioOriginRef.current;

      const from = scannedToRef.current ?? elapsed;
      const to = elapsed + LOOKAHEAD_MS;
      scannedToRef.current = to;

      const beatMs = beatDurationMs(current.tempo);
      for (const beat of beatsInWindow(current.tempo, from, to)) {
        const beatElapsed = beat * beatMs;
        // Stop at the end of the song; the count-in beats before zero still play.
        if (beatElapsed >= current.totalMs) continue;
        const at = audioOrigin + beatElapsed / 1000;
        if (at < ctx.currentTime) continue;
        scheduleClick(ctx, at, isAccent(beat, current.beatsPerLine));
      }
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
      scannedToRef.current = null;
      audioOriginRef.current = null;
    };
  }, [enabled, isPlaying, originMs, scheduleClick]);

  // Release the audio device when the player goes away.
  useEffect(
    () => () => {
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    },
    []
  );
}
