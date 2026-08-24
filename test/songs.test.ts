import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BARS_PER_LINE,
  MAX_LEARNING_PLAYTHROUGH,
  completeLearningPlaythrough,
  createRow,
  createSong,
  deleteRow,
  resetLearningProgress,
  rowsFromPastedText,
  setCurrentKey,
  songToText,
  textToRows,
  updateRow,
} from '../src/lib/songs';

describe('createSong', () => {
  it('SG-01 seeds a song with one empty row and sane defaults', () => {
    const song = createSong();
    expect(song.id).toBeTruthy();
    expect(song.rows).toHaveLength(1);
    expect(song.rows[0].lyrics).toBe('');
    expect(song.rows[0].chords).toEqual([]);
    expect(song.rows[0].beats).toBeNull();
    expect(song.barsPerLine).toBe(DEFAULT_BARS_PER_LINE);
    expect(song.originalKey).toBe('C');
    expect(song.currentKey).toBe('C');
    expect(song.tempo).toBeGreaterThan(0);
    expect(song.learningPlaythrough).toBe(0);
  });

  it('accepts overrides and gives every song a distinct id', () => {
    const song = createSong({ title: 'Scarborough Fair', originalKey: 'Dm' });
    expect(song.title).toBe('Scarborough Fair');
    expect(song.originalKey).toBe('Dm');
    // A song created in Dm should also be displayed in Dm until transposed.
    expect(song.currentKey).toBe('Dm');
    const ids = new Set(Array.from({ length: 50 }, () => createSong().id));
    expect(ids.size).toBe(50);
  });

  it('gives every row a distinct id', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createRow().id));
    expect(ids.size).toBe(50);
  });
});

describe('rowsFromPastedText', () => {
  it('SG-02 makes one row per pasted line', () => {
    const rows = rowsFromPastedText('line one\nline two\nline three');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.lyrics)).toEqual(['line one', 'line two', 'line three']);
    expect(rows.every((r) => r.chords.length === 0 && r.beats === null)).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });

  it('SG-03 drops trailing blank lines but keeps interior ones', () => {
    const rows = rowsFromPastedText('verse\n\nchorus\n\n\n');
    expect(rows.map((r) => r.lyrics)).toEqual(['verse', '', 'chorus']);
  });

  it('SG-04 handles CRLF line endings', () => {
    const rows = rowsFromPastedText('one\r\ntwo\r\n');
    expect(rows.map((r) => r.lyrics)).toEqual(['one', 'two']);
  });

  it('SG-12 parses inline chord markup out of pasted lines', () => {
    const rows = rowsFromPastedText('[G]I am a young maiden and my [C]story is [G]sad,');
    expect(rows).toHaveLength(1);
    expect(rows[0].lyrics).toBe('I am a young maiden and my story is sad,');
    expect(rows[0].chords.map((c) => c.symbol)).toEqual(['G', 'C', 'G']);
  });

  it('SG-13 reads a line length written as /n/', () => {
    const rows = rowsFromPastedText('[Am]Great God, and [E]I for [Am]one./12/\n[Am]plain line');
    expect(rows.map((r) => r.beats)).toEqual([12, null]);
    expect(rows[0].lyrics).toBe('Great God, and I for one.');
  });

  it('returns an empty list for blank input', () => {
    expect(rowsFromPastedText('')).toEqual([]);
    expect(rowsFromPastedText('\n\n')).toEqual([]);
  });
});

describe('row editing', () => {
  const base = createSong({
    rows: [
      { id: 'r1', lyrics: 'first', chords: [{ symbol: 'C', index: 0 }], beats: null, bars: null, meter: null },
      { id: 'r2', lyrics: 'second', chords: [{ symbol: 'G', index: 0 }], beats: 12, bars: null, meter: null },
    ],
  });

  it('SG-06 deletes a row', () => {
    const next = deleteRow(base, 'r1');
    expect(next.rows.map((r) => r.id)).toEqual(['r2']);
  });

  it('SG-06 keeps at least one row present', () => {
    const single = createSong({
      rows: [{ id: 'only', lyrics: 'x', chords: [], beats: null, bars: null, meter: null }],
    });
    const next = deleteRow(single, 'only');
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].lyrics).toBe('');
    expect(next.rows[0].id).not.toBe('only');
  });

  it('ignores a delete for an unknown row id', () => {
    expect(deleteRow(base, 'nope').rows).toHaveLength(2);
  });

  it('SG-07 patches one field of one row without touching its siblings', () => {
    const next = updateRow(base, 'r2', { chords: [{ symbol: 'Am', index: 0 }] });
    expect(next.rows[1].chords).toEqual([{ symbol: 'Am', index: 0 }]);
    expect(next.rows[1].lyrics).toBe('second');
    expect(next.rows[1].beats).toBe(12);
    expect(next.rows[0]).toEqual(base.rows[0]);
  });
});

describe('the whole song as text (ADR-010)', () => {
  const source = [
    '[Am]There is a [C]house in New [D]Orleans,',
    "[Am]It's called the [E]Rising [Am]Sun./12/",
    '',
    'a line with no chords',
  ].join('\n');

  it('SG-15 round-trips song text through rows unchanged', () => {
    const song = createSong({ rows: textToRows(source) });
    expect(songToText(song)).toBe(source);
  });

  it('SG-16 makes one row per line, blank lines included', () => {
    const rows = textToRows(source);
    expect(rows).toHaveLength(4);
    expect(rows[2]).toMatchObject({ lyrics: '', chords: [], beats: null, bars: null, meter: null });
    expect(rows[1].beats).toBe(12);
  });

  it('SG-17 keeps row ids stable when a line is edited', () => {
    const rows = textToRows(source);
    const edited = textToRows(source.replace('Orleans', 'Orleans!'), rows);
    expect(edited.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    expect(edited[0].lyrics).toContain('Orleans!');
  });

  it('SG-18 gives a newly typed line its own id', () => {
    const rows = textToRows(source);
    const extended = textToRows(`${source}\nbrand new line`, rows);
    expect(extended).toHaveLength(5);
    expect(extended.slice(0, 4).map((r) => r.id)).toEqual(rows.map((r) => r.id));
    expect(rows.map((r) => r.id)).not.toContain(extended[4].id);
  });

  it('SG-19 keeps a trailing blank line so Enter works at the end', () => {
    expect(textToRows('one\n')).toHaveLength(2);
    expect(textToRows('')).toHaveLength(1);
  });
});

describe('learning progress', () => {
  it('SG-08 increments the completed-playthrough counter', () => {
    let song = createSong();
    expect(song.learningPlaythrough).toBe(0);
    song = completeLearningPlaythrough(song);
    expect(song.learningPlaythrough).toBe(1);
    song = completeLearningPlaythrough(song);
    expect(song.learningPlaythrough).toBe(2);
  });

  it('SG-09 saturates at the last concealment stage', () => {
    let song = createSong();
    for (let i = 0; i < 20; i += 1) {
      song = completeLearningPlaythrough(song);
    }
    expect(song.learningPlaythrough).toBe(MAX_LEARNING_PLAYTHROUGH);
    expect(MAX_LEARNING_PLAYTHROUGH).toBe(5);
  });

  it('SG-10 resets the counter to zero', () => {
    let song = createSong();
    song = completeLearningPlaythrough(completeLearningPlaythrough(song));
    expect(song.learningPlaythrough).toBe(2);
    expect(resetLearningProgress(song).learningPlaythrough).toBe(0);
  });

  it('reset leaves the rest of the song alone', () => {
    const song = completeLearningPlaythrough(createSong({ title: 'Keep me', tempo: 140 }));
    const reset = resetLearningProgress(song);
    expect(reset.title).toBe('Keep me');
    expect(reset.tempo).toBe(140);
    expect(reset.rows).toEqual(song.rows);
  });
});

describe('setCurrentKey', () => {
  it('SG-11 changes only the display key, never the stored chords', () => {
    const song = createSong({
      originalKey: 'C',
      rows: [
        {
          id: 'r1',
          lyrics: 'x',
          chords: [
            { symbol: 'C', index: 0 },
            { symbol: 'Am', index: 1 },
          ],
          beats: null,
          bars: null,
          meter: null,
        },
      ],
    });
    const transposed = setCurrentKey(song, 'G');
    expect(transposed.currentKey).toBe('G');
    expect(transposed.originalKey).toBe('C');
    expect(transposed.rows[0].chords).toEqual(song.rows[0].chords);
  });
});
