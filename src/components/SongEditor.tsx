import { useEffect, useRef, useState } from 'react';
import { KeySelect } from './KeySelect';
import { formatInlineRow, parseInlineRow } from '../lib/inline';
import {
  addRowAfter,
  createRow,
  deleteRow,
  moveRow,
  rowsFromPastedText,
  updateRow,
} from '../lib/songs';
import type { Song } from '../types/song';

interface SongEditorProps {
  song: Song;
  onChange: (song: Song) => void;
}

type Field = 'line' | 'beats' | 'pause';

const focusKey = (rowId: string, field: Field) => `${rowId}:${field}`;

/**
 * The song editor: one row per lyric line.
 *
 * Each row is a single text field holding the line in inline notation — `[G]lyric` — which is both
 * the fastest thing to type and the format the fixtures use (ADR-007). Entry speed is the priority
 * (UX priority 1), so the keyboard does the work: Enter opens the next row, Backspace on an empty
 * row removes it, and pasting a block of lyrics expands into one row per line. Every edit flows
 * straight to `onChange`, which persists it.
 */
export function SongEditor({ song, onChange }: SongEditorProps) {
  const inputs = useRef(new Map<string, HTMLInputElement | null>());
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocus) return;
    inputs.current.get(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  const registerInput = (rowId: string, field: Field) => (element: HTMLInputElement | null) => {
    const key = focusKey(rowId, field);
    if (element) inputs.current.set(key, element);
    else inputs.current.delete(key);
  };

  const handleEnter = (index: number) => {
    const next = addRowAfter(song, index);
    onChange(next);
    setPendingFocus(focusKey(next.rows[index + 1].id, 'line'));
  };

  const handleBackspaceOnEmptyRow = (index: number) => {
    if (song.rows.length <= 1) return;
    const previous = song.rows[index - 1];
    onChange(deleteRow(song, song.rows[index].id));
    if (previous) setPendingFocus(focusKey(previous.id, 'line'));
  };

  /** Pasting several lines turns each one into its own row, as the brief requires. */
  const handlePaste = (index: number, text: string) => {
    const pasted = rowsFromPastedText(text);
    if (pasted.length <= 1) return false;

    const rows = [...song.rows];
    const current = rows[index];
    const isEmptyRow = current.lyrics.trim() === '' && current.chords.length === 0;
    rows.splice(index, isEmptyRow ? 1 : 0, ...pasted);
    onChange({ ...song, rows });
    setPendingFocus(focusKey(pasted[pasted.length - 1].id, 'line'));
    return true;
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
      </div>

      {transposed && (
        <p className="editor__note">
          Chords are stored in {song.originalKey}, the song&rsquo;s original key. The player is
          showing them in {song.currentKey}.
        </p>
      )}

      <div className="editor__head">
        <span>Line — write chords in brackets, e.g. [G]lyric</span>
        <span>Beats</span>
        <span>Pause (s)</span>
        <span />
      </div>

      <ol className="editor__rows">
        {song.rows.map((row, index) => (
          <li key={row.id} className="editor__row">
            <input
              ref={registerInput(row.id, 'line')}
              className="editor__input editor__input--line"
              value={formatInlineRow(row)}
              placeholder="[C]Lyric line with [G]chords in brackets"
              spellCheck={false}
              aria-label={`Line ${index + 1}`}
              onChange={(event) => onChange(updateRow(song, row.id, parseInlineRow(event.target.value)))}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text');
                if (handlePaste(index, text)) event.preventDefault();
              }}
              onKeyDown={(event) => {
                const value = event.currentTarget.value;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleEnter(index);
                } else if (event.key === 'Backspace' && value === '') {
                  event.preventDefault();
                  handleBackspaceOnEmptyRow(index);
                }
              }}
            />

            <input
              ref={registerInput(row.id, 'beats')}
              className="editor__input editor__input--number"
              type="number"
              min={1}
              step={1}
              value={row.beats}
              aria-label={`Beats for line ${index + 1}`}
              onChange={(event) =>
                onChange(
                  updateRow(song, row.id, {
                    beats: Math.max(1, Number(event.target.value) || 1),
                  })
                )
              }
            />

            <input
              ref={registerInput(row.id, 'pause')}
              className="editor__input editor__input--number"
              type="number"
              min={0}
              step={0.5}
              value={row.pauseSeconds}
              aria-label={`Pause after line ${index + 1} in seconds`}
              onChange={(event) =>
                onChange(
                  updateRow(song, row.id, {
                    pauseSeconds: Math.max(0, Number(event.target.value) || 0),
                  })
                )
              }
            />

            <div className="editor__row-actions">
              <button
                type="button"
                className="icon-button"
                title="Move line up"
                aria-label={`Move line ${index + 1} up`}
                disabled={index === 0}
                onClick={() => onChange(moveRow(song, index, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                title="Move line down"
                aria-label={`Move line ${index + 1} down`}
                disabled={index === song.rows.length - 1}
                onClick={() => onChange(moveRow(song, index, 1))}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                title="Delete line"
                aria-label={`Delete line ${index + 1}`}
                onClick={() => onChange(deleteRow(song, row.id))}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="button"
        onClick={() => {
          const rows = [...song.rows, createRow()];
          onChange({ ...song, rows });
          setPendingFocus(focusKey(rows[rows.length - 1].id, 'line'));
        }}
      >
        Add line
      </button>

      <p className="editor__hint">
        Write chords inline in brackets, where they fall in the lyric:{' '}
        <code>[Am]There is a [C]house in New [D]Orleans,</code>. Paste a block of lyrics to create
        one line per row. Press <kbd>Enter</kbd> for the next line, <kbd>Backspace</kbd> on an empty
        line to remove it.
      </p>
    </div>
  );
}
