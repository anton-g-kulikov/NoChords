import { describe, expect, it } from 'vitest';
import { songFromDoc, songToDoc } from '../src/lib/songDoc';
import { createSong, rowsFromPastedText } from '../src/lib/songs';
import { MAX_SONG_TEXT } from '../src/lib/bounds';
import type { Song } from '../src/types/song';

const sample: Song = {
  id: 'song-1',
  title: 'House of the Rising Sun',
  originalKey: 'Am',
  currentKey: 'Cm',
  tempo: 80,
  tempoUnit: 'quarter',
  barsPerLine: 6,
  meter: '3/4',
  displayMode: 'nashville',
  openedAt: 1760000000000,
  learningPlaythrough: 3,
  rows: [
    {
      id: 'r1',
      lyrics: 'There is a house in New Orleans,',
      chords: [
        { symbol: 'Am', index: 0 },
        { symbol: 'C', index: 11 },
        { symbol: 'D', index: 24 },
      ],
      bars: null,
      meter: null,
    },
    {
      id: 'r2',
      lyrics: 'Great God, and I for one.',
      chords: [{ symbol: 'Am', index: 0 }],
      bars: 4,
      meter: null,
    },
  ],
};

describe('songToDoc / songFromDoc', () => {
  it('SD-01 round-trips a song unchanged', () => {
    expect(songFromDoc(songToDoc(sample))).toEqual(sample);
  });

  it('SD-02 carries the id as a field as well as the document key', () => {
    expect(songToDoc(sample).id).toBe('song-1');
  });

  it('SD-03 keeps rows with their chords, anchors and bar overrides', () => {
    const back = songFromDoc(songToDoc(sample));
    expect(back?.rows).toHaveLength(2);
    expect(back?.rows[0].chords).toEqual(sample.rows[0].chords);
    expect(back?.rows[1].bars).toBe(4);
  });

  it('SD-04 keeps bars: null rather than losing it', () => {
    const doc = songToDoc(sample);
    expect(doc.rows[0].bars).toBeNull();
    expect(songFromDoc(doc)?.rows[0].bars).toBeNull();
  });

  it('SD-05 rejects a document missing required fields', () => {
    expect(songFromDoc({ id: 'x', title: 'no rows' })).toBeNull();
    expect(songFromDoc({})).toBeNull();
    expect(songFromDoc(null)).toBeNull();
    expect(songFromDoc('nonsense')).toBeNull();
  });

  it('SD-06 rejects wrongly typed fields', () => {
    expect(songFromDoc({ ...songToDoc(sample), tempo: 'fast' })).toBeNull();
    expect(songFromDoc({ ...songToDoc(sample), barsPerLine: null })).toBeNull();
    expect(songFromDoc({ ...songToDoc(sample), rows: 'not an array' })).toBeNull();
  });

  it('SD-07 rejects the whole song when a row is malformed', () => {
    const doc = songToDoc(sample);
    expect(songFromDoc({ ...doc, rows: [...doc.rows, { id: 'bad' }] })).toBeNull();
    expect(
      songFromDoc({ ...doc, rows: [{ ...doc.rows[0], chords: [{ symbol: 'C' }] }] })
    ).toBeNull();
  });

  it('SD-08 drops unknown fields rather than letting them into the app', () => {
    const withExtras = { ...songToDoc(sample), sneaky: 'value', updatedAt: 12345 };
    expect(songFromDoc(withExtras)).toEqual(sample);
  });

  it('SD-10 carries the tempo unit, and supplies one for a document written without it', () => {
    expect(songToDoc(sample).tempoUnit).toBe('quarter');

    const { tempoUnit: _dropped, ...legacy } = songToDoc({ ...sample, meter: '6/8' });
    // A document from before units is read the way it was played: 6/8 counted in eighths.
    expect(songFromDoc(legacy)?.tempoUnit).toBe('eighth');
  });

  it('SD-09 writes no undefined, which Firestore refuses', () => {
    const seen: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (value === undefined) seen.push(path);
      else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
      }
    };
    walk(songToDoc(sample), 'doc');
    walk(songToDoc(createSong({ title: 'fresh' })), 'new');
    expect(seen).toEqual([]);
  });

  it('SD-11 no longer writes a song\'s count-in, and reads past one an older version wrote (ADR-094)', () => {
    expect('countInBars' in songToDoc(sample)).toBe(false);
    const older = { ...songToDoc(sample), countInBars: 2 };
    const read = songFromDoc(older);
    expect(read?.id).toBe(sample.id);
    expect(read && 'countInBars' in read).toBe(false);
  });

  it('SD-12 writes the chord display, and opens a document written without it on names (ADR-095)', () => {
    expect(songToDoc(sample).displayMode).toBe('nashville');
    expect(songFromDoc(songToDoc(sample))?.displayMode).toBe('nashville');
    const { displayMode: _dropped, ...stored } = songToDoc(sample);
    expect(songFromDoc(stored)?.displayMode).toBe('full');
  });

  it('SD-13 writes when a song was last opened, as null when never, and reads a missing one as never (ADR-106)', () => {
    expect(songFromDoc(songToDoc(sample))?.openedAt).toBe(1760000000000);
    expect(songToDoc({ ...sample, openedAt: null }).openedAt).toBeNull();
    const { openedAt: _dropped, ...older } = songToDoc(sample);
    expect(songFromDoc(older)?.openedAt).toBeNull();
  });

  it('SD-14 **keeps the densest song the editor allows under Firestore\'s 1 MiB** (ADR-108)', () => {
    // Firestore's document size: each string is its UTF-8 bytes plus one, each field name likewise,
    // each number 8 bytes, null 1, plus 32 bytes for the document. A chord is the expensive part.
    const size = (value: unknown): number => {
      if (value === null) return 1;
      if (typeof value === 'string') return Buffer.byteLength(value, 'utf8') + 1;
      if (typeof value === 'number' || typeof value === 'boolean') return 8;
      if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + size(item), 0);
      return Object.entries(value as object).reduce(
        (sum, [key, item]) => sum + Buffer.byteLength(key, 'utf8') + 1 + size(item),
        0
      );
    };
    const docBytes = (text: string) => 32 + size(songToDoc({ ...sample, rows: rowsFromPastedText(text) }));
    const fill = (unit: string) => unit.repeat(Math.floor(MAX_SONG_TEXT / unit.length));
    for (const unit of ['[C]', '[Am]', '[Am]la la la ', 'Чёрный ворон, что ты вьёшься\n']) {
      expect(docBytes(fill(unit)), unit).toBeLessThan(1024 * 1024);
    }
  });

  it('round-trips a song the app itself just made', () => {
    const song = createSong({ title: 'Fresh' });
    expect(songFromDoc(songToDoc(song))).toEqual(song);
  });
});
