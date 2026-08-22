/**
 * The development fixtures from `_meta/example-songs.md`, ready to load into the library.
 *
 * They are written in the same inline notation the editor uses, and parsed by the same importer
 * the paste path uses (`rowsFromPastedText`) — so the fixtures double as a check that the importer
 * handles real material, and there is no second parser to keep in step. The `duration` values of
 * the source document became the songs' `beatsPerLine` (ADR-011); its `pause` values became a
 * longer final line, written `/12/` — one extra bar at the end of each verse (ADR-011).
 *
 * The lyrics are traditional public-domain texts; the chord placements and timings are the
 * fixture document's own test arrangements, not transcriptions of any recorded arrangement.
 */
import { createSong, rowsFromPastedText } from './songs';
import type { Song } from '../types/song';

interface ExampleSource {
  title: string;
  key: string;
  tempo: number;
  /** These are 3/4 songs written as two bars a line. */
  beatsPerLine: number;
  fixture: string;
}

const SCARBOROUGH_FAIR = `
[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Remember me to a [C]lass that lives [Dm]there,
[Dm]For she was once a [C]true love of [Dm]mine./12/
[Dm]And tell her to [C]make me a [Dm]cambric shirt,
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Without any seam or [C]needle[Dm]work,
[Dm]And then she shall be a [C]true love of [Dm]mine./12/
[Dm]And tell her to [C]wash it in [Dm]yonder dry well,
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Where no water sprung nor a [C]drop of rain [Dm]fell,
[Dm]And then she shall be a [C]true love of [Dm]mine./12/
[Dm]And tell her to [C]dry it on [Dm]yonder thorn,
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Which never bore blossom since [C]Adam was [Dm]born,
[Dm]And then she shall be a [C]true love of [Dm]mine./12/
`;

const BLACKBIRD = `
[G]I am a young maiden and my [C]story is [G]sad,
[G]For once I was courted by a [D]brave sailor [G]lad.
[G]He courted me truly by [C]night and by [G]day,
[G]But now he has left me and [D]gone far a[G]way./12/
[G]If I were a blackbird, I'd [C]whistle and [G]sing,
[G]I'd follow the ship that my [D]true love sails [G]in.
[G]And in the top rigging I'd [C]there build my [G]nest,
[G]And I'd pillow my head on his [D]lily-white [G]breast./12/
[G]He promised to take me to [C]Donnybrook [G]Fair,
[G]To buy me red ribbons to [D]tie up my [G]hair.
[G]And I know that some day he'll come [C]back o'er the [G]tide,
[G]And surely he'll make me his [D]own loving [G]bride./12/
[G]His parents they chide me and [C]will not a[G]gree,
[G]That me and my sailor boy [D]married should [G]be.
[G]But let them deride me and [C]do what they [G]will,
[G]While there's dance in my body, he's the [D]one I love [G]still./12/
`;

const RISING_SUN = `
[Am]There is a [C]house in New [D]Orleans,
[Am]It's called the [E]Rising [Am]Sun.
[Am]It's been the [C]ruin of many a [D]poor girl,
[Am]Great God, and [E]I for [Am]one./12/
[Am]If I had [C]listened to what my [D]mother said,
[Am]I'd have been at [E]home to[Am]day.
[Am]But I was [C]young and foolish,
[Am]And a gambler [E]led me a[Am]stray./12/
`;

const SOURCES: ExampleSource[] = [
  { title: 'Scarborough Fair', key: 'Dm', tempo: 90, beatsPerLine: 6, fixture: SCARBOROUGH_FAIR },
  { title: 'If I Was a Blackbird', key: 'G', tempo: 90, beatsPerLine: 6, fixture: BLACKBIRD },
  { title: 'House of the Rising Sun', key: 'Am', tempo: 80, beatsPerLine: 6, fixture: RISING_SUN },
];

/** Builds a fresh copy of each example song, with new ids every call. */
export function createExampleSongs(): Song[] {
  return SOURCES.map((source) =>
    createSong({
      title: source.title,
      originalKey: source.key,
      currentKey: source.key,
      tempo: source.tempo,
      beatsPerLine: source.beatsPerLine,
      rows: rowsFromPastedText(source.fixture.trim()),
    })
  );
}
