/**
 * The development fixtures from `_meta/example-songs.md`, ready to load into the library.
 *
 * They are stored in exactly the format that document uses, and parsed by the same importer the
 * paste path uses (`rowsFromPastedText`) — so the fixtures double as a check that the importer
 * handles real material, and there is no second parser to keep in step.
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
  fixture: string;
}

const SCARBOROUGH_FAIR = `
[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?
duration: 6 | pause: 0

[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
duration: 6 | pause: 0

[Dm]Remember me to a [C]lass that lives [Dm]there,
duration: 6 | pause: 0

[Dm]For she was once a [C]true love of [Dm]mine.
duration: 6 | pause: 2

[Dm]And tell her to [C]make me a [Dm]cambric shirt,
duration: 6 | pause: 0

[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
duration: 6 | pause: 0

[Dm]Without any seam or [C]needle[Dm]work,
duration: 6 | pause: 0

[Dm]And then she shall be a [C]true love of [Dm]mine.
duration: 6 | pause: 2

[Dm]And tell her to [C]wash it in [Dm]yonder dry well,
duration: 6 | pause: 0

[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
duration: 6 | pause: 0

[Dm]Where no water sprung nor a [C]drop of rain [Dm]fell,
duration: 6 | pause: 0

[Dm]And then she shall be a [C]true love of [Dm]mine.
duration: 6 | pause: 2

[Dm]And tell her to [C]dry it on [Dm]yonder thorn,
duration: 6 | pause: 0

[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
duration: 6 | pause: 0

[Dm]Which never bore blossom since [C]Adam was [Dm]born,
duration: 6 | pause: 0

[Dm]And then she shall be a [C]true love of [Dm]mine.
duration: 6 | pause: 3
`;

const BLACKBIRD = `
[G]I am a young maiden and my [C]story is [G]sad,
duration: 6 | pause: 0

[G]For once I was courted by a [D]brave sailor [G]lad.
duration: 6 | pause: 0

[G]He courted me truly by [C]night and by [G]day,
duration: 6 | pause: 0

[G]But now he has left me and [D]gone far a[G]way.
duration: 6 | pause: 2

[G]If I were a blackbird, I'd [C]whistle and [G]sing,
duration: 6 | pause: 0

[G]I'd follow the ship that my [D]true love sails [G]in.
duration: 6 | pause: 0

[G]And in the top rigging I'd [C]there build my [G]nest,
duration: 6 | pause: 0

[G]And I'd pillow my head on his [D]lily-white [G]breast.
duration: 6 | pause: 2

[G]He promised to take me to [C]Donnybrook [G]Fair,
duration: 6 | pause: 0

[G]To buy me red ribbons to [D]tie up my [G]hair.
duration: 6 | pause: 0

[G]And I know that some day he'll come [C]back o'er the [G]tide,
duration: 6 | pause: 0

[G]And surely he'll make me his [D]own loving [G]bride.
duration: 6 | pause: 2

[G]His parents they chide me and [C]will not a[G]gree,
duration: 6 | pause: 0

[G]That me and my sailor boy [D]married should [G]be.
duration: 6 | pause: 0

[G]But let them deride me and [C]do what they [G]will,
duration: 6 | pause: 0

[G]While there's dance in my body, he's the [D]one I love [G]still.
duration: 6 | pause: 3
`;

const RISING_SUN = `
[Am]There is a [C]house in New [D]Orleans,
duration: 6 | pause: 0

[Am]It's called the [E]Rising [Am]Sun.
duration: 6 | pause: 0

[Am]It's been the [C]ruin of many a [D]poor girl,
duration: 6 | pause: 0

[Am]Great God, and [E]I for [Am]one.
duration: 6 | pause: 2

[Am]If I had [C]listened to what my [D]mother said,
duration: 6 | pause: 0

[Am]I'd have been at [E]home to[Am]day.
duration: 6 | pause: 0

[Am]But I was [C]young and foolish,
duration: 6 | pause: 0

[Am]And a gambler [E]led me a[Am]stray.
duration: 6 | pause: 3
`;

const SOURCES: ExampleSource[] = [
  { title: 'Scarborough Fair', key: 'Dm', tempo: 90, fixture: SCARBOROUGH_FAIR },
  { title: 'If I Was a Blackbird', key: 'G', tempo: 90, fixture: BLACKBIRD },
  { title: 'House of the Rising Sun', key: 'Am', tempo: 80, fixture: RISING_SUN },
];

/** Builds a fresh copy of each example song, with new ids every call. */
export function createExampleSongs(): Song[] {
  return SOURCES.map((source) =>
    createSong({
      title: source.title,
      originalKey: source.key,
      currentKey: source.key,
      tempo: source.tempo,
      rows: rowsFromPastedText(source.fixture.trim()),
    })
  );
}
