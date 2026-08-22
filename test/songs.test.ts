import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BEATS,
  MAX_LEARNING_PLAYTHROUGH,
  addRowAfter,
  completeLearningPlaythrough,
  createRow,
  createSong,
  deleteRow,
  resetLearningProgress,
  rowsFromPastedText,
  setCurrentKey,
  updateRow,
} from '../src/lib/songs';

describe('createSong', () => {
  it('SG-01 seeds a song with one empty row and sane defaults', () => {
    const song = createSong();
    expect(song.id).toBeTruthy();
    expect(song.rows).toHaveLength(1);
    expect(song.rows[0].lyrics).toBe('');
    expect(song.rows[0].chords).toEqual([]);
    expect(song.rows[0].pauseSeconds).toBe(0);
    expect(song.rows[0].beats).toBe(DEFAULT_BEATS);
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
    expect(rows.every((r) => r.chords.length === 0 && r.pauseSeconds === 0)).toBe(true);
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

  it('SG-13 applies fixture "duration | pause" metadata to the row above it', () => {
    const rows = rowsFromPastedText(
      [
        '[Am]There is a [C]house in New [D]Orleans,',
        'duration: 6 | pause: 0',
        '',
        "[Am]It's called the [E]Rising [Am]Sun.",
        'duration: 6 | pause: 2',
      ].join('\n')
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.beats)).toEqual([6, 6]);
    expect(rows.map((r) => r.pauseSeconds)).toEqual([0, 2]);
    expect(rows[1].lyrics).toBe("It's called the Rising Sun.");
  });

  it('SG-14 drops the blank separator lines only in fixture-formatted text', () => {
    const fixture = rowsFromPastedText('a\nduration: 6 | pause: 0\n\nb\nduration: 6 | pause: 0');
    expect(fixture.map((r) => r.lyrics)).toEqual(['a', 'b']);

    // Without metadata the same blank line is an interior blank the user meant to keep.
    const plain = rowsFromPastedText('a\n\nb');
    expect(plain.map((r) => r.lyrics)).toEqual(['a', '', 'b']);
  });

  it('returns an empty list for blank input', () => {
    expect(rowsFromPastedText('')).toEqual([]);
    expect(rowsFromPastedText('\n\n')).toEqual([]);
  });
});

describe('row editing', () => {
  const base = createSong({
    rows: [
      { id: 'r1', lyrics: 'first', chords: [{ symbol: 'C', index: 0 }], beats: 4, pauseSeconds: 0 },
      { id: 'r2', lyrics: 'second', chords: [{ symbol: 'G', index: 0 }], beats: 4, pauseSeconds: 1 },
    ],
  });

  it('SG-05 inserts a new row after the given index with a fresh id', () => {
    const next = addRowAfter(base, 0);
    expect(next.rows.map((r) => r.lyrics)).toEqual(['first', '', 'second']);
    expect(next.rows[1].id).not.toBe('r1');
    expect(next.rows[1].id).not.toBe('r2');
    // The original song is not mutated.
    expect(base.rows).toHaveLength(2);
  });

  it('appends when the index is the last row', () => {
    expect(addRowAfter(base, 1).rows.map((r) => r.lyrics)).toEqual(['first', 'second', '']);
  });

  it('SG-06 deletes a row', () => {
    const next = deleteRow(base, 'r1');
    expect(next.rows.map((r) => r.id)).toEqual(['r2']);
  });

  it('SG-06 keeps at least one row present', () => {
    const single = createSong({
      rows: [{ id: 'only', lyrics: 'x', chords: [], beats: 4, pauseSeconds: 0 }],
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
    expect(next.rows[1].pauseSeconds).toBe(1);
    expect(next.rows[0]).toEqual(base.rows[0]);
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
          beats: 4,
          pauseSeconds: 0,
        },
      ],
    });
    const transposed = setCurrentKey(song, 'G');
    expect(transposed.currentKey).toBe('G');
    expect(transposed.originalKey).toBe('C');
    expect(transposed.rows[0].chords).toEqual(song.rows[0].chords);
  });
});
