/**
 * The development fixtures from `_meta/example-songs.md`, ready to load into the library.
 *
 * They are written in the same inline notation the editor uses, and parsed by the same importer
 * the paste path uses (`rowsFromPastedText`) — so the fixtures double as a check that the importer
 * handles real material, and there is no second parser to keep in step. The `duration` values of
 * the source document became the songs' `beatsPerLine` (ADR-011); its `pause` values became a
 * longer final line, written `|4|` — twice the usual two bars at the end of each verse (ADR-032).
 *
 * The lyrics are traditional public-domain texts; the chord placements and timings are the
 * fixture document's own test arrangements, not transcriptions of any recorded arrangement.
 */
import { createSong, rowsFromPastedText } from "./songs";
import type { TempoUnit } from "./tempo";
import type { Song } from "../types/song";

interface ExampleSource {
  title: string;
  key: string;
  tempo: number;
  /** What the tempo counts. The 6/8 fixture is written in eighths, not its dotted pulse. */
  tempoUnit: TempoUnit;
  /** How many bars a line lasts by default (ADR-032). */
  barsPerLine: number;
  /** The time signature, which sets bar length and where the accent falls (ADR-026). */
  meter: string;
  fixture: string;
}

const SCARBOROUGH_FAIR = `
[Dm]O, where are you [C]going? To [Dm]Scarborough Fair?
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Remember me to a [C]lass that lives [Dm]there,
[Dm]For she was once a [C]true love of [Dm]mine.|4|
[Dm]And tell her to [C]make me a [Dm]cambric shirt,
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Without any seam or [C]needle[Dm]work,
[Dm]And then she shall be a [C]true love of [Dm]mine.|4|
[Dm]And tell her to [C]wash it in [Dm]yonder dry well,
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Where no water sprung nor a [C]drop of rain [Dm]fell,
[Dm]And then she shall be a [C]true love of [Dm]mine.|4|
[Dm]And tell her to [C]dry it on [Dm]yonder thorn,
[Dm]Savoury, sage, [C]rosemary and [Dm]thyme,
[Dm]Which never bore blossom since [C]Adam was [Dm]born,
[Dm]And then she shall be a [C]true love of [Dm]mine.|4|
`;

const BLACKBIRD = `
[G]I am a young maiden and my [C]story is [G]sad,
[G]For once I was courted by a [D]brave sailor [G]lad.
[G]He courted me truly by [C]night and by [G]day,
[G]But now he has left me and [D]gone far a[G]way.|4|
[G]If I were a blackbird, I'd [C]whistle and [G]sing,
[G]I'd follow the ship that my [D]true love sails [G]in.
[G]And in the top rigging I'd [C]there build my [G]nest,
[G]And I'd pillow my head on his [D]lily-white [G]breast.|4|
[G]He promised to take me to [C]Donnybrook [G]Fair,
[G]To buy me red ribbons to [D]tie up my [G]hair.
[G]And I know that some day he'll come [C]back o'er the [G]tide,
[G]And surely he'll make me his [D]own loving [G]bride.|4|
[G]His parents they chide me and [C]will not a[G]gree,
[G]That me and my sailor boy [D]married should [G]be.
[G]But let them deride me and [C]do what they [G]will,
[G]While there's dance in my body, he's the [D]one I love [G]still.|4|
`;

const RISING_SUN = `
There [Am]is a [C]house in New [D]Orleans, [F]
They [Am]call the [C]Rising [E]Sun,
And it's [Am]been the [C]ruin of [D]many a poor boy, [F]
Dear [Am]God, I [E]know I was [Am]one.
[C] [D] [F]
[Am] [E] [Am] [E]

My [Am]mother [C]was a [D]tailor, [F]
She [Am]sewed my [C]new blue [E]jeans, 
And my [Am]father [C]was a [D]gamblin' [F]man, 
[Am]Way down in [E]New Or[Am]leans.
[C] [D] [F]
[Am] [E] [Am] [E]

And the [Am]only [C]thing a [D]gambler [F]needs, 
Is a [Am]suitcase [C]and a [E]trunk,
And the [Am]only [C]time he's s[D]atis[F]fied,
[Am]Is when he[E]'s a [Am]drunk.
[C] [D] [F]
[Am] [E] [Am] [E]

Oh, [Am]mother, [C]tell your [D]children, [F]
Not to [Am]do [C]what I have [E]done,
To [Am]spend your [C]lives in [D]sin and mise[F]ry,
In the [Am]house of the [E]rising [Am]sun.
[C] [D] [F]
[Am] [E] [Am] [E]

I [Am]got one [C]foot on the [D]platform, [F]
And [Am]another [C]on the [E]train,
And I'm [Am]going [C]back to [D]New Or[F]leans,
To [Am]wear that [E]ball and [Am]chain.
[C] [D] [F]
[Am] [E] [Am] [E]

There [Am]is a [C]house in New [D]Orleans, [F]
They [Am]call the [C]Rising [E]Sun,
And it's [Am]been the [C]ruin of [D]many a poor boy, [F]
Dear [Am]God, I [E]know I was [Am]one.|3|
{3/4}[C] [D] [F]|2|
[Am] [E] [Am] [E]|2|
`;

const SOURCES: ExampleSource[] = [
  {
    title: "Scarborough Fair",
    key: "Dm",
    tempo: 90,
    tempoUnit: "quarter",
    barsPerLine: 2,
    meter: "3/4",
    fixture: SCARBOROUGH_FAIR,
  },
  {
    title: "If I Was a Blackbird",
    key: "G",
    tempo: 90,
    tempoUnit: "quarter",
    barsPerLine: 2,
    meter: "3/4",
    fixture: BLACKBIRD,
  },
  {
    title: "House of the Rising Sun",
    key: "Am",
    tempo: 80,
    tempoUnit: "eighth",
    barsPerLine: 1,
    meter: "6/8",
    fixture: RISING_SUN,
  },
];

/** Builds a fresh copy of each example song, with new ids every call. */
export function createExampleSongs(): Song[] {
  return SOURCES.map((source) =>
    createSong({
      title: source.title,
      originalKey: source.key,
      currentKey: source.key,
      tempo: source.tempo,
      tempoUnit: source.tempoUnit,
      barsPerLine: source.barsPerLine,
      meter: source.meter,
      rows: rowsFromPastedText(source.fixture.trim()),
    }),
  );
}
