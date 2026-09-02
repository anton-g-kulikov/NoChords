import { useEffect, useRef, useState } from 'react';
import { KeySelect } from './KeySelect';
import { COMMON_METERS } from '../lib/meter';
import { MAX_TEMPO, MIN_TEMPO } from '../lib/playback';
import { NumberField } from './NumberField';
import { TempoField } from './TempoField';
import { songToText, textToRows } from '../lib/songs';
import type { Song } from '../types/song';

interface SongEditorProps {
  song: Song;
  onOpenGuide: () => void;
  onChange: (song: Song) => void;
  /** Deleting is an editing action, so it lives here rather than beside every row (ADR-063). */
  onDelete: () => void;
}

/**
 * The song editor: the whole song in one text area, one line per row (ADR-010).
 *
 * The text is the editing buffer and rows are derived from it on every keystroke. Crucially the
 * text area is never re-rendered from the parsed rows while the user is typing — if it were,
 * normalising a line (moving a `/6/` to the end, say) would jump the caret mid-word. It is only
 * re-seeded when a different song is opened.
 */
export function SongEditor({ song, onChange, onOpenGuide, onDelete }: SongEditorProps) {
  const [text, setText] = useState(() => songToText(song));

  /**
   * The text area grows to its content rather than scrolling inside itself (ADR-049).
   *
   * With its own scrollbar it swallowed the drag: a finger on the song scrolled the song, never
   * the page, so the fields above it never left the screen and the bottom of the editor could not
   * be reached at all. One scroller for the screen, and this is not it.
   */
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const area = textRef.current;
    if (!area) return;

    /*
     * Where the browser can size a text area to its content, let it: `field-sizing: content` does
     * this without ever collapsing the box, which is what the fallback below has to do in order to
     * measure. That collapse is the suspected cause of the view jumping on paste — suspected, not
     * proven, because it does not reproduce on a desktop (ADR-051).
     */
    if (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')) {
      // Drop any height this fallback set before, or it would override the browser's sizing.
      area.style.height = '';
      return;
    }

    // Preserve the scroll position across the measurement, since the page is briefly shorter than
    // its own scroll offset while the box is collapsed.
    const scroller = area.closest('.screen__scroll');
    const scrollTop = scroller?.scrollTop;

    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;

    if (scroller && scrollTop !== undefined) scroller.scrollTop = scrollTop;
  }, [text]);
  const openSongId = useRef(song.id);

  useEffect(() => {
    if (openSongId.current === song.id) return;
    openSongId.current = song.id;
    setText(songToText(song));
  }, [song]);

  const handleText = (value: string) => {
    setText(value);
    onChange({ ...song, rows: textToRows(value, song.rows) });
  };

  const transposed = song.currentKey !== song.originalKey;

  // The legend teaches by example, so its examples have to be this song's: a hint that says
  // "two bars of 4/4" to someone writing in 6/8 teaches the wrong thing twice over.
  const longerLine = song.barsPerLine + 1;
  const otherMeter = song.meter === '4/4' ? '3/4' : '4/4';
  const placeholder = `There [Am]is a [C]house in New [D]Orleans,\nThey [Am]call the [C]Rising [E]Sun,|${longerLine}|`;

  return (
    <div className="editor">
      <div className="editor__meta">
        <KeySelect
          label="Original key"
          value={song.originalKey}
          onChange={(originalKey) =>
            // Follow the display key along unless the user has deliberately transposed.
            onChange({
              ...song,
              originalKey,
              currentKey: transposed ? song.currentKey : originalKey,
            })
          }
        />

        <label className="field field--narrow">
          <span className="field__label">Meter</span>
          <select
            className="field__input"
            value={song.meter}
            onChange={(event) => onChange({ ...song, meter: event.target.value })}
          >
            {COMMON_METERS.map((meter) => (
              <option key={meter} value={meter}>
                {meter}
              </option>
            ))}
          </select>
        </label>

        {/* The meter next door does not touch this: a unit the writer chose is theirs to change,
            so switching to 6/8 never silently rewrites what the number counts (ADR-052). */}
        <TempoField
          value={song.tempo}
          unit={song.tempoUnit}
          min={MIN_TEMPO}
          max={MAX_TEMPO}
          onCommit={(tempo) => onChange({ ...song, tempo })}
          onUnitChange={(tempoUnit) => onChange({ ...song, tempoUnit })}
        />

        <NumberField
          label="Bars per line"
          value={song.barsPerLine}
          min={1}
          max={64}
          onCommit={(barsPerLine) => onChange({ ...song, barsPerLine })}
        />
      </div>

      {transposed && (
        <p className="editor__note">
          Chords are stored in {song.originalKey}, the song&rsquo;s original key. The player is
          showing them in {song.currentKey}.
        </p>
      )}

      {/* Above the text area, not below it: it is instructions for what you are about to type,
          and it reads in this song's own terms rather than in examples from another one. */}
      <p className="editor__hint">
        One line per lyric line. Write chords in brackets where they fall in the words —{' '}
        <code>There [Am]is a [C]house</code>. A line lasts{' '}
        <strong>
          {song.barsPerLine} bar{song.barsPerLine === 1 ? '' : 's'} of {song.meter}
        </strong>{' '}
        unless it says otherwise: end it with <code>|{longerLine}|</code> to give it{' '}
        {longerLine} bars instead. Start a line with <code>{'{'}{otherMeter}{'}'}</code> to change
        meter from there on, and it stays changed until the next one. Everything saves as you type.{' '}
        <button type="button" className="library__install" onClick={onOpenGuide}>
          What is a bar?
        </button>
      </p>

      <label className="field">
        <span className="field__label">Song</span>
        <textarea
          ref={textRef}
          className="editor__text"
          value={text}
          spellCheck={false}
          rows={8}
          aria-label="Song text"
          placeholder={placeholder}
          onChange={(event) => handleText(event.target.value)}
        />
      </label>

      {/* Last, and past the song itself: the one action here that cannot be undone (ADR-063). */}
      <div className="editor__danger">
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            if (window.confirm(`Delete “${song.title || 'Untitled song'}”?`)) onDelete();
          }}
        >
          Delete song
        </button>
      </div>
    </div>
  );
}
