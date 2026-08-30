import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Brain, ListMinus, ListRestart, Metronome, SlidersVertical } from 'lucide-react';
import { toNashville } from '../lib/nashville';
import { KeyStepper } from './KeyStepper';
import { NumberInput } from './NumberInput';
import { TempoField } from './TempoField';
import { BeatStrip } from './BeatStrip';
import { SongRowView } from './SongRowView';
import { useFitScale } from '../hooks/useFitScale';
import { MAX_TEMPO, MIN_TEMPO, buildSchedule } from '../lib/playback';
import { msPerMeterBeat } from '../lib/tempo';
import { beatsPerBarOf } from '../lib/meter';
import {
  MAX_LEVEL,
  collectChordOccurrences,
  createConcealment,
  levelFor,
  ruleFor,
} from '../lib/learning';
import {
  completeLearningPlaythrough,
  resetLearningProgress,
  setCurrentKey,
  setLearningLevel,
} from '../lib/songs';
import { usePlayback } from '../hooks/usePlayback';
import { useMetronome } from '../hooks/useMetronome';
import { useWakeLock } from '../hooks/useWakeLock';
import { accentAt, countInDurationMs, pulseAt } from '../lib/metronome';
import { MAX_COUNT_IN_BARS, countInBarsFor, type Settings } from '../lib/settings';
import {
  isDoubleTap,
  isRevealed,
  nextExpiry,
  pruneReveals,
  revealRow,
  type LastTap,
  type Reveals,
} from '../lib/reveal';
import type { DisplayMode, Song } from '../types/song';

interface PlayerProps {
  song: Song;
  onChange: (song: Song) => void;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
}

const MODES: Array<{ value: DisplayMode; hint: string }> = [
  { value: 'full', hint: 'Chord names in the current key' },
  { value: 'nashville', hint: 'Scale degrees relative to the original key' },
  { value: 'learning', hint: 'Chord names with a share of them concealed' },
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
  /**
   * Key, tempo and metronome are set before you play, not during. On a phone they filled most of
   * the screen, leaving almost nothing for the chart, so they collapse the moment playback starts
   * and can be reopened at any time.
   */
  const [setupOpen, setSetupOpen] = useState(true);
  /** The metronome opens on its own: it is reached for at different moments to the song's
   *  settings, and often while they are shut (ADR-042). */
  const [metronomeOpen, setMetronomeOpen] = useState(false);
  /** Lines whose concealed chords are showing, and when each stops (ADR-018). */
  const [reveals, setReveals] = useState<Reveals>({});
  const lastTap = useRef<LastTap | null>(null);

  const schedule = useMemo(
    () => buildSchedule(song.rows, song.tempo, song.barsPerLine, song.meter, song.tempoUnit),
    [song.rows, song.tempo, song.barsPerLine, song.meter, song.tempoUnit]
  );

  const handleComplete = useCallback(() => {
    if (mode !== 'learning') return;
    // A finished learning run advances progress, and the next run gets a fresh selection.
    onChange(completeLearningPlaythrough(song));
    setConcealSeed(randomSeed());
  }, [mode, onChange, song]);

  const beatsPerBar = beatsPerBarOf(song.meter);
  // One beat of the song's own meter — an eighth in 6/8 — at whatever note value its tempo counts.
  const beatMs = msPerMeterBeat(song.meter, song.tempo, song.tempoUnit);
  // A count-in is counted in the song's own time: one bar of 6/8 is six beats, of 3/4 three.
  const countInBars = countInBarsFor(settings.countInBars, song.barsPerLine);
  const countInMs = countInDurationMs(beatMs, countInBars * beatsPerBar);

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

  /*
   * Where the beat is, read from the schedule rather than from a clock of its own, so the dots and
   * the clicks cannot disagree (ADR-059).
   */
  const pulse = pulseAt(schedule, elapsedMs);

  /*
   * Whether the strip holds the playing marker rather than a lyric line.
   *
   * It does whenever nothing has been sung yet — counting, or sitting at the top waiting to. A
   * marker on the first line of a song nobody has started says "here", when what happens next is
   * the count (ADR-059).
   */
  const stripLeads = countingIn || (!isPlaying && elapsedMs <= 0);

  /*
   * The chart shrinks to fit its longest line rather than letting it wrap (ADR-054). It depends on
   * the rows, the key the chords are shown in, and the mode — Nashville numerals are narrower than
   * chord names, and a transposed key can be wider than the one it came from. Not on concealment:
   * a concealed chord keeps its box and only blurs, which is exactly what ADR-007 buys.
   */
  const sheetRef = useRef<HTMLOListElement>(null);
  const sheetScale = useFitScale(sheetRef, [song.rows, song.currentKey, mode]);

  // A chart you are reading from is a page you never touch, so the phone dims it mid-verse.
  useWakeLock(isPlaying);

  useMetronome({
    enabled: settings.metronomeEnabled,
    volume: settings.metronomeVolume,
    beatMs,
    schedule,
    isPlaying,
    originMs,
    totalMs,
  });

  const playbackRef = useRef(playback);
  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  const concealed = useMemo(
    () =>
      mode === 'learning'
        ? createConcealment(song.rows, song.learningPlaythrough, concealSeed)
        : EMPTY_CONCEALMENT,
    [mode, song.rows, song.learningPlaythrough, concealSeed]
  );

  // Collapse on play, but deliberately do not reopen on pause: a pause is usually momentary, and
  // having the controls spring back would shift the chart out from under you every time.
  useEffect(() => {
    if (isPlaying) {
      setSetupOpen(false);
      setMetronomeOpen(false);
    }
  }, [isPlaying]);

  /**
   * A tap reveals the line straight away; a second tap inside the double-tap window also seeks.
   * Revealing first means the chord appears with no wait, and the stray reveal on the way to a
   * seek costs nothing because it expires by itself.
   */
  const handleRowTap = useCallback(
    (index: number, rowId: string) => {
      if (mode !== 'learning') {
        playbackRef.current.seekToRow(index);
        return;
      }
      const now = Date.now();
      if (isDoubleTap(lastTap.current, rowId, now)) {
        playbackRef.current.seekToRow(index);
      }
      lastTap.current = { rowId, atMs: now };
      setReveals((current) => revealRow(current, rowId, now));
    },
    [mode]
  );

  /**
   * Clear reveals as they run out. Playback re-renders constantly, but when paused nothing would
   * otherwise trigger the render that drops an expired reveal — so schedule it.
   */
  useEffect(() => {
    const soonest = nextExpiry(reveals);
    if (soonest === null) return undefined;
    const timer = window.setTimeout(
      () => setReveals((current) => pruneReveals(current, Date.now())),
      Math.max(0, soonest - Date.now()) + 20
    );
    return () => window.clearTimeout(timer);
  }, [reveals]);

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
  // Re-read on every render; playback drives those while playing, and the expiry timer when not.
  const now = Date.now();
  /*
   * Each button previews its own mode (ADR-044): the key you would read, the numeral you would
   * read instead, and a brain for the one that hides them. Shorter than the words, and it answers
   * "what is Nashville?" by showing the answer rather than naming it.
   */
  const firstChord = song.rows.find((row) => row.chords.length > 0)?.chords[0]?.symbol;
  const modeLabels: Record<DisplayMode, ReactNode> = {
    full: song.currentKey,
    nashville: firstChord ? toNashville(firstChord, song.originalKey) : 'I',
    learning: <Brain size={20} aria-hidden />,
  };

  const concealmentPercent =
    totalChords === 0 ? 0 : Math.round((concealed.size / totalChords) * 100);
  const level = levelFor(song.learningPlaythrough);
  const rule = ruleFor(level);

  return (
    <div className="player">
      <div className="screen__scroll player__chart">
      {/*
       * Settings live at the top and the transport at the bottom (ADR-036): two different jobs,
       * and on a phone only one of them belongs under a thumb. The strip is pinned so the panel
       * can be opened from anywhere in a long song, not only from the top of it.
       */}
      <div className="player__header">
      <div className="settings-bar">
        {/* In the strip rather than the panel (ADR-040): it is the one control reached for
            mid-song, and the panel is shut while playing. Not in the transport, which is a
            thumb-slip from Play and already at the width of a phone. */}
          <div className="controls__group" role="group" aria-label="Chord display">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.hint}
                aria-label={option.value}
                aria-pressed={mode === option.value}
                className={mode === option.value ? 'segment segment--active' : 'segment'}
                onClick={() => setMode(option.value)}
              >
                {modeLabels[option.value]}
              </button>
            ))}
          </div>

        {/* The two disclosures travel together, at the end of the strip. */}
        <div className="settings-bar__actions">
          <button
            type="button"
            /* Two things at once: a blue icon means the beat is being heard, a blue button means
               this panel is open (ADR-042). */
            className={[
              'button button--icon settings-bar__toggle',
              metronomeOpen ? 'settings-bar__toggle--open' : '',
              settings.metronomeEnabled ? 'settings-bar__toggle--live' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-expanded={metronomeOpen}
            aria-label={metronomeOpen ? 'Hide metronome' : 'Metronome'}
            /* What it does, not what the sound is doing: the strip already says that. */
            title={metronomeOpen ? 'Hide metronome settings' : 'Metronome settings'}
            onClick={() => setMetronomeOpen((open) => !open)}
          >
            <Metronome size={20} aria-hidden />
          </button>

          <button
            type="button"
            className={
              setupOpen
                ? 'button button--icon settings-bar__toggle settings-bar__toggle--open'
                : 'button button--icon settings-bar__toggle'
            }
            aria-expanded={setupOpen}
            aria-label={setupOpen ? 'Hide settings' : 'Settings'}
            title={setupOpen ? 'Hide settings' : 'Settings'}
            onClick={() => setSetupOpen((open) => !open)}
          >
            {/* Faders rather than a cog: these are values to be set, not a system to configure. */}
            <SlidersVertical size={20} aria-hidden />
          </button>
        </div>
      </div>

      {/* Inside the pinned header (ADR-060): a panel you open while deep in a song opens where
          you are, rather than at the top of a page you would have to scroll back to. */}
      <div
        className={
          setupOpen || metronomeOpen
            ? 'controls__setup'
            : 'controls__setup controls__setup--closed'
        }
      >
          {/*
           * Three groups, because there are three questions: how the chart reads, how fast it
           * moves, and whether it clicks. Before this they were one row of eight controls in the
           * order they happened to be written (ADR-034).
           */}
          {/*
           * Grouped by how long a change lasts, not by what it looks like (ADR-039). The three
           * used to sit in one row: a display mode forgotten on the way out, a key saved to this
           * song, and a count-in that quietly changed every song on the device.
           */}
          {setupOpen && (
          <section className="setup__group" aria-label="This song">
            <h2 className="setup__legend">This song</h2>
            <div className="setup__row">
              <KeyStepper
                value={song.currentKey}
                originalKey={song.originalKey}
                onChange={(key) => onChange(setCurrentKey(song, key))}
              />

              {/* Shown, not offered: the meter decides what a bar is, and changing it here would
                  silently re-time every line of the song (ADR-034). */}
              <div className="field field--tiny">
                <span className="field__label">Meter</span>
                <p className="field__static">{song.meter}</p>
              </div>
            </div>
          </section>
          )}

          {metronomeOpen && (
          <section className="setup__group" aria-label="Metronome">
            <h2 className="setup__legend">
              Metronome
            </h2>
            <div className="setup__row">
              {/* Tempo leads: it is the first thing a metronome is asked for, and the click
                  and the chart run on the same number (ADR-059). Switching the sound itself is on
                  the beat strip, on the thing it governs. */}
              <TempoField
                className="field field--tempo-compact"
                value={song.tempo}
                unit={song.tempoUnit}
                min={MIN_TEMPO}
                max={MAX_TEMPO}
                onCommit={(tempo) => onChange({ ...song, tempo })}
                onUnitChange={(tempoUnit) => onChange({ ...song, tempoUnit })}
              />

              <label className="metronome__volume" title={`Metronome volume ${Math.round(settings.metronomeVolume * 100)}%`}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path
                    fill="currentColor"
                    d="M4 9.5h3.2L12 5.5v13l-4.8-4H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"
                  />
                  <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
                  </g>
                </svg>
                <input
                  className="field__range metronome__range"
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

              {/* Auto is a real value here, not an empty field: it means one line's worth of
                  bars, which changes with the song (ADR-059). */}
              <div className="field field--narrow">
                <span className="field__label">Count-in (bars)</span>
                <div className="count-in-field">
                  <button
                    type="button"
                    className={
                      settings.countInBars === null ? 'segment segment--active' : 'segment'
                    }
                    aria-pressed={settings.countInBars === null}
                    title="Match the song's bars per line"
                    onClick={() => onSettingsChange({ countInBars: null })}
                  >
                    Auto
                  </button>
                  <NumberInput
                    className="field__input count-in-field__value"
                    value={countInBars}
                    min={0}
                    max={MAX_COUNT_IN_BARS}
                    aria-label="Count-in bars"
                    onCommit={(bars) => onSettingsChange({ countInBars: bars })}
                  />
                </div>
              </div>
            </div>
          </section>
          )}
      </div>


      {mode === 'learning' && setupOpen && (
        <div className="learning-bar">
          {/* The level gets a row to itself: it is the one thing here you set, rather than read. */}
          <div className="learning-bar__levels">
            <span className="learning-bar__label">Level</span>
            <div className="learning-bar__steps">
              {Array.from({ length: MAX_LEVEL }, (_, index) => index + 1).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === level ? 'segment segment--active' : 'segment'}
                  aria-label={`Level ${option}`}
                  aria-pressed={option === level}
                  onClick={() => onChange(setLearningLevel(song, option))}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="learning-bar__text">
            <strong>{concealmentPercent}% concealed</strong>
            <span>
              {level === 1
                ? 'First verse and chorus in full; their repeats start to go'
                : `${Math.round(rule.fresh * 100)}% of every section`}
              {rule.concealFirst
                ? ' — opening chords included'
                : ' — the first chord of each line stays'}
              . Tap a line to see it again.
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

      {/* Before a note is played the strip shows the bar it is about to count, not the first beat
          of a song nobody has started. Once the song has moved — playing, paused, or parked on a
          line you tapped — it shows where that is. */}
      <BeatStrip
        pulse={isPlaying || elapsedMs > 0 ? pulse : null}
        counting={countingIn}
        marked={stripLeads}
        countInBars={countInBars}
        countInRemaining={countInRemaining}
        beatsPerBar={beatsPerBar}
        isAccent={(beatInBar) => accentAt(beatInBar - 1, schedule)}
        meter={song.meter}
        sound={settings.metronomeEnabled}
        onSoundChange={(metronomeEnabled) => onSettingsChange({ metronomeEnabled })}
        />
      </div>

      {/* One type scale for the whole song, set by its longest line (ADR-054). */}
      <ol className="sheet" ref={sheetRef} style={{ '--sheet-scale': sheetScale } as CSSProperties}>
        {song.rows.map((row, index) => (
          <li
            key={row.id}
            ref={(element) => {
              rowRefs.current[index] = element;
            }}
            className={[
              'sheet__row',
              // The marker belongs to the strip until a line is actually being sung; it arrives
              // here on the downbeat.
              index === activeIndex && !stripLeads ? 'sheet__row--active' : '',
              activeIndex >= 0 && index < activeIndex ? 'sheet__row--played' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleRowTap(index, row.id)}
          >
            <SongRowView
              row={row}
              song={song}
              mode={mode}
              concealed={concealed}
              revealed={isRevealed(reveals, row.id, now)}
            />
            {/* A line that runs longer or shorter than the song's default says so, quietly:
                the chart is for reading lyrics, and this is a note in the margin (ADR-032). */}
            {row.bars && row.bars !== song.barsPerLine && (
              <span className="sheet__bars">{row.bars} bars</span>
            )}
          </li>
        ))}
      </ol>
      </div>

      <div className="controls">
        <div className="controls__transport">
          {/* Play keeps its word — the one control that must be unmistakable mid-song — and takes
              40% of the bar. Time in the middle; restart at the far end, furthest from a thumb
              aiming at Play (ADR-048). */}
          <button
            type="button"
            className="button button--primary controls__play"
            onClick={toggle}
          >
            <ListMinus size={18} aria-hidden />
            {isPlaying ? 'Pause' : finished ? 'Play again' : 'Play'}
          </button>

          <span className="controls__time">
            {countingIn ? `count-in ${countInRemaining}` : formatTime(elapsedMs)} /{' '}
            {formatTime(totalMs)}
          </span>

          <button
            type="button"
            className="button button--icon controls__restart"
            aria-label="Restart"
            title="Restart"
            onClick={restart}
          >
            <ListRestart size={20} aria-hidden />
          </button>
        </div>

      </div>
    </div>
  );
}
