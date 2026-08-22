import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeySelect } from './KeySelect';
import { SongRowView } from './SongRowView';
import { buildSchedule } from '../lib/playback';
import { collectChordOccurrences, concealmentFor, createConcealment } from '../lib/learning';
import { completeLearningPlaythrough, resetLearningProgress, setCurrentKey } from '../lib/songs';
import { usePlayback } from '../hooks/usePlayback';
import { useMetronome } from '../hooks/useMetronome';
import { beatDurationMs, countInDurationMs } from '../lib/metronome';
import { MAX_COUNT_IN_BEATS, type Settings } from '../lib/settings';
import type { DisplayMode, Song } from '../types/song';

interface PlayerProps {
  song: Song;
  onChange: (song: Song) => void;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
}

const MODES: Array<{ value: DisplayMode; label: string; hint: string }> = [
  { value: 'full', label: 'Full', hint: 'Chord names in the current key' },
  { value: 'nashville', label: 'Nashville', hint: 'Scale degrees relative to the original key' },
  { value: 'learning', label: 'Learning', hint: 'Chord names with a share of them concealed' },
];

const EMPTY_CONCEALMENT: Set<string> = new Set();

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The playing view: automated scrolling through the song with the active row highlighted.
 *
 * Learning concealment is seeded once per playthrough and held in state, so re-rendering as the
 * song scrolls cannot reshuffle which chords are hidden (ADR-002).
 */
export function Player({ song, onChange, settings, onSettingsChange }: PlayerProps) {
  const [mode, setMode] = useState<DisplayMode>('full');
  const [concealSeed, setConcealSeed] = useState(randomSeed);

  const schedule = useMemo(
    () => buildSchedule(song.rows, song.tempo, song.beatsPerLine),
    [song.rows, song.tempo, song.beatsPerLine]
  );

  const handleComplete = useCallback(() => {
    if (mode !== 'learning') return;
    // A finished learning run advances progress, and the next run gets a fresh selection.
    onChange(completeLearningPlaythrough(song));
    setConcealSeed(randomSeed());
  }, [mode, onChange, song]);

  const beatMs = beatDurationMs(song.tempo);
  const countInMs = countInDurationMs(song.tempo, settings.countInBeats);

  const playback = usePlayback(schedule, { countInMs, beatMs, onComplete: handleComplete });
  const {
    activeIndex,
    isPlaying,
    toggle,
    restart,
    elapsedMs,
    totalMs,
    finished,
    countingIn,
    countInRemaining,
    originMs,
  } = playback;

  useMetronome({
    enabled: settings.metronomeEnabled,
    volume: settings.metronomeVolume,
    tempo: song.tempo,
    beatsPerLine: song.beatsPerLine,
    isPlaying,
    originMs,
    totalMs,
  });

  const concealed = useMemo(
    () =>
      mode === 'learning'
        ? createConcealment(song.rows, song.learningPlaythrough, concealSeed)
        : EMPTY_CONCEALMENT,
    [mode, song.rows, song.learningPlaythrough, concealSeed]
  );

  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  useEffect(() => {
    if (activeIndex < 0) return;
    rowRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  // Space plays and pauses, so the transport is reachable without aiming at a button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // Below the last stage the opening chord of each line is protected, so the achieved share can
  // fall short of the nominal one. Report what is actually hidden (ADR-013).
  const totalChords = useMemo(() => collectChordOccurrences(song.rows).length, [song.rows]);
  const concealmentPercent =
    totalChords === 0 ? 0 : Math.round((concealed.size / totalChords) * 100);
  const stagePercent = Math.round(concealmentFor(song.learningPlaythrough) * 100);

  return (
    <div className="player">
      <div className="controls">
        <div className="controls__transport">
          <button type="button" className="button button--primary" onClick={toggle}>
            {isPlaying ? 'Pause' : finished ? 'Play again' : 'Play'}
          </button>
          <button type="button" className="button" onClick={restart}>
            Restart
          </button>
          <span className="controls__time">
            {countingIn ? `count-in ${countInRemaining}` : formatTime(elapsedMs)} /{' '}
            {formatTime(totalMs)}
          </span>
        </div>

        <div className="controls__group" role="group" aria-label="Display mode">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              title={option.hint}
              aria-pressed={mode === option.value}
              className={mode === option.value ? 'segment segment--active' : 'segment'}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <KeySelect
          label="Key"
          value={song.currentKey}
          originalKey={song.originalKey}
          onChange={(key) => onChange(setCurrentKey(song, key))}
        />

        <label className="field field--tempo">
          <span className="field__label">Tempo {song.tempo} bpm</span>
          <input
            className="field__range"
            type="range"
            min={40}
            max={200}
            value={song.tempo}
            aria-label="Tempo in beats per minute"
            onChange={(event) => onChange({ ...song, tempo: Number(event.target.value) })}
          />
        </label>

        <div className="metronome">
          <button
            type="button"
            className={settings.metronomeEnabled ? 'button button--primary' : 'button'}
            aria-pressed={settings.metronomeEnabled}
            title="Click on every beat while playing"
            onClick={() => onSettingsChange({ metronomeEnabled: !settings.metronomeEnabled })}
          >
            {settings.metronomeEnabled ? 'Metronome on' : 'Metronome off'}
          </button>

          <label className="field field--narrow">
            <span className="field__label">
              Volume {Math.round(settings.metronomeVolume * 100)}%
            </span>
            <input
              className="field__range"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.metronomeVolume * 100)}
              disabled={!settings.metronomeEnabled}
              aria-label="Metronome volume"
              onChange={(event) =>
                onSettingsChange({ metronomeVolume: Number(event.target.value) / 100 })
              }
            />
          </label>

          <label className="field field--narrow">
            <span className="field__label">Count-in</span>
            <input
              className="field__input"
              type="number"
              min={0}
              max={MAX_COUNT_IN_BEATS}
              value={settings.countInBeats}
              aria-label="Count-in beats"
              onChange={(event) =>
                onSettingsChange({ countInBeats: Number(event.target.value) || 0 })
              }
            />
          </label>
        </div>
      </div>

      {countingIn && (
        <div className="count-in" role="status" aria-live="polite">
          <span className="count-in__number">{countInRemaining}</span>
          <span className="count-in__label">counting in</span>
        </div>
      )}

      {mode === 'learning' && (
        <div className="learning-bar">
          <div className="learning-bar__text">
            <strong>{concealmentPercent}% concealed</strong>
            <span>
              {song.learningPlaythrough} of 5 playthroughs completed
              {concealmentPercent === 100
                ? ' — all chord cues hidden'
                : concealmentPercent < stagePercent
                  ? ` — ${stagePercent}% stage, first chord of each line kept`
                  : ''}
            </span>
          </div>
          <div
            className="learning-bar__meter"
            role="progressbar"
            aria-valuenow={concealmentPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="learning-bar__fill" style={{ width: `${concealmentPercent}%` }} />
          </div>
          <button
            type="button"
            className="button"
            onClick={() => {
              onChange(resetLearningProgress(song));
              setConcealSeed(randomSeed());
            }}
          >
            Reset learning progress
          </button>
        </div>
      )}

      <ol className="sheet">
        {song.rows.map((row, index) => (
          <li
            key={row.id}
            ref={(element) => {
              rowRefs.current[index] = element;
            }}
            className={index === activeIndex ? 'sheet__row sheet__row--active' : 'sheet__row'}
            onClick={() => playback.seekToRow(index)}
          >
            <SongRowView row={row} song={song} mode={mode} concealed={concealed} />
            {row.beats && row.beats !== song.beatsPerLine && (
              <span className="sheet__beats">{row.beats}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
