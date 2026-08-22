import { useEffect, useRef, useState } from 'react';
import { KeySelect } from './KeySelect';
import { songToText, textToRows } from '../lib/songs';
import type { Song } from '../types/song';

interface SongEditorProps {
  song: Song;
  onChange: (song: Song) => void;
}

/**
 * The song editor: the whole song in one text area, one line per row (ADR-010).
 *
 * The text is the editing buffer and rows are derived from it on every keystroke. Crucially the
 * text area is never re-rendered from the parsed rows while the user is typing — if it were,
 * normalising a line (moving a `/6/` to the end, say) would jump the caret mid-word. It is only
 * re-seeded when a different song is opened.
 */
export function SongEditor({ song, onChange }: SongEditorProps) {
  const [text, setText] = useState(() => songToText(song));
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

  return (
    <div className="editor">
      <div className="editor__meta">
        <label className="field">
          <span className="field__label">Title</span>
          <input
            className="field__input"
            value={song.title}
            placeholder="Untitled song"
            onChange={(event) => onChange({ ...song, title: event.target.value })}
          />
        </label>

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
          <span className="field__label">Tempo (bpm)</span>
          <input
            className="field__input"
            type="number"
            min={20}
            max={300}
            value={song.tempo}
            onChange={(event) =>
              onChange({ ...song, tempo: Number(event.target.value) || song.tempo })
            }
          />
        </label>

        <label className="field field--narrow">
          <span className="field__label">Beats per line</span>
          <input
            className="field__input"
            type="number"
            min={1}
            max={64}
            value={song.beatsPerLine}
            onChange={(event) =>
              onChange({ ...song, beatsPerLine: Number(event.target.value) || song.beatsPerLine })
            }
          />
        </label>
      </div>

      {transposed && (
        <p className="editor__note">
          Chords are stored in {song.originalKey}, the song&rsquo;s original key. The player is
          showing them in {song.currentKey}.
        </p>
      )}

      <label className="field">
        <span className="field__label">Song</span>
        <textarea
          className="editor__text"
          value={text}
          spellCheck={false}
          rows={20}
          aria-label="Song text"
          placeholder={'[Am]There is a [C]house in New [D]Orleans,\n[Am]Great God, and [E]I for [Am]one./12/'}
          onChange={(event) => handleText(event.target.value)}
        />
      </label>

      <p className="editor__hint">
        One line per lyric line. Write chords in brackets where they fall in the words —{' '}
        <code>[Am]There is a [C]house</code>. A line lasts {song.beatsPerLine} beats unless it says
        otherwise: end it with <code>/12/</code> to hold it for twelve. Everything saves as you
        type.
      </p>
    </div>
  );
}
