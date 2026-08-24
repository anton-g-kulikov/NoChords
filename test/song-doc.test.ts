import { describe, expect, it } from 'vitest';
import { songFromDoc, songToDoc } from '../src/lib/songDoc';
import { createSong } from '../src/lib/songs';
import type { Song } from '../src/types/song';

const sample: Song = {
  id: 'song-1',
  title: 'House of the Rising Sun',
  originalKey: 'Am',
  currentKey: 'Cm',
  tempo: 80,
  barsPerLine: 6,
  meter: '3/4',
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
      beats: null,
      bars: null,
      meter: null,
    },
    {
      id: 'r2',
      lyrics: 'Great God, and I for one.',
      chords: [{ symbol: 'Am', index: 0 }],
      beats: 12,
      bars: null,
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

  it('SD-03 keeps rows with their chords, anchors and beat overrides', () => {
    const back = songFromDoc(songToDoc(sample));
    expect(back?.rows).toHaveLength(2);
    expect(back?.rows[0].chords).toEqual(sample.rows[0].chords);
    expect(back?.rows[1].beats).toBe(12);
  });

  it('SD-04 keeps beats: null rather than losing it', () => {
    const doc = songToDoc(sample);
    expect(doc.rows[0].beats).toBeNull();
    expect(songFromDoc(doc)?.rows[0].beats).toBeNull();
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

  it('round-trips a song the app itself just made', () => {
    const song = createSong({ title: 'Fresh' });
    expect(songFromDoc(songToDoc(song))).toEqual(song);
  });
});
