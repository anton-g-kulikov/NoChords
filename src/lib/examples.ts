/**
 * The development fixtures from `_meta/example-songs.md`, ready to load into the library.
 *
 * They are written in the same inline notation the editor uses, and parsed by the same importer
 * the paste path uses (`rowsFromPastedText`) — so the fixtures double as a check that the importer
 * handles real material, and there is no second parser to keep in step. The `duration` values of
 * the source document became the songs' `beatsPerLine` (ADR-011); its `pause` values became a
 * longer final line, written `|4|` — twice the usual two bars at the end of each verse (ADR-032).
 * The Rising Sun opens on a two-line intro — Am, C, D, F, then E, Am, E — closes every verse on the
 * C it resolves to, then plays the turnaround — D, F, Am, E, Am, E — as one line of six bars, a bar
 * to each chord (`|6|`).
 *
 * The lyrics are public-domain texts — traditional folk songs, Постой, паровоз among them
 * (ADR-089); the chord placements and timings are the fixture document's own test arrangements,
 * not transcriptions of any recorded arrangement.
 */
import { createSong, rowsFromPastedText } from "./songs";
import type { TempoUnit } from "./tempo";
import type { DisplayMode, Song } from "../types/song";

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
  /** How the chart opens, when chord names are not the point (ADR-095). */
  displayMode?: DisplayMode;
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
[Am] [C] [D] [F]
[E] [Am] [E]

There [Am]is a [C]house in New [D]Orleans, [F]
They [Am]call the [C]Rising [E]Sun,
And it's [Am]been the [C]ruin of [D]many a poor boy, [F]
Dear [Am]God, I [E]know I was [Am]one.  [C]
[D] [F] [Am] [E] [Am] [E] |6|

My [Am]mother [C]was a [D]tailor, [F]
She [Am]sewed my [C]new blue [E]jeans, 
And my [Am]father [C]was a [D]gamblin' [F]man, 
[Am]Way down in [E]New Or[Am]leans. [C]
[D] [F] [Am] [E] [Am] [E] |6|

And the [Am]only [C]thing a [D]gambler [F]needs, 
Is a [Am]suitcase [C]and a [E]trunk,
And the [Am]only [C]time he's s[D]atis[F]fied,
[Am]Is when he[E]'s a [Am]drunk. [C] 
[D] [F] [Am] [E] [Am] [E] |6|

Oh, [Am]mother, [C]tell your [D]children, [F]
Not to [Am]do [C]what I have [E]done,
To [Am]spend your [C]lives in [D]sin and mise[F]ry,
In the [Am]house of the [E]rising [Am]sun. [C]
[D] [F] [Am] [E] [Am] [E] |6|

I [Am]got one [C]foot on the [D]platform, [F]
And [Am]another [C]on the [E]train,
And I'm [Am]going [C]back to [D]New Or[F]leans,
To [Am]wear that [E]ball and [Am]chain. [C]
[D] [F] [Am] [E] [Am] [E] |6|

There [Am]is a [C]house in New [D]Orleans, [F]
They [Am]call the [C]Rising [E]Sun,
And it's [Am]been the [C]ruin of [D]many a poor boy, [F]
Dear [Am]God, I [E]know I was [Am]one. [C]
[D] [F] [Am] [E] [Am] [E] |6|
`;

const POSTOY_PAROVOZ = `
Пос[C#m]той, паро[F#m]воз...
Не сту[G#]чите, ко[C#m]леса...
Кон[E]дуктор - нажми на тормоза [G#]... |8|
Я к [C#m]маменьке родной
С пос[C#]ледним при[F#m]ветом
Спе[G#]шу показаться на гла[C#m]за [G#] |8|
Я к [C#m]маменьке родной
С пос[C#]ледним при[F#m]ветом
Спе[G#]шу показаться на гла[C#m]за [G#] |8|

Не [C#m]жди меня - [F#m]мама
Хо[G#]рошего [C#m]сына
Твой [E]сын - не такой, как был вчера [G#]... |8|
Ме[C#m]ня засосала
О[C#]пасная тря[F#m]сина
И [G#]жизнь моя - вечная И[C#m]гра [G#] |8|
Ме[C#m]ня засосала
О[C#]пасная тря[F#m]сина
И [G#]жизнь моя - вечная И[C#m]гра [G#] |8|

А [C#m]если по[F#m]садят
Ме[G#]ня за ре[C#m]шетку
Я [E]буду сидеть и помирать [G#] |8|
По[C#m]ка еще не поздно
Сде[C#]лать оста[F#m]новку
Кон[G#]дуктор - нажми на тормо[C#m]за... [G#] |8|
По[C#m]ка еще не поздно
Сде[C#]лать оста[F#m]новку
Кон[G#]дуктор - нажми на тормо[C#m]за... [G#] |8|

Пос[C#m]той паро[F#m]воз...
Не сту[G#]чите ко[C#m]леса...
Кон[E]дуктор - нажми на тормоза [G#]... |8|
Я к [C#m]маменьке родной
Боль[C#]ной и го[F#m]лодный
Спе[G#]шу показаться на гла[C#m]за [G#] |8|
Я к [C#m]маменьке родной
Боль[C#]ной и го[F#m]лодный
Спе[G#]шу показаться на гла[C#m]за [G#] |8|
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
    // ♪ = 180 is a dotted quarter of 60: one bar of 6/8 every two seconds.
    tempo: 180,
    tempoUnit: "eighth",
    // A bar to each chord of a verse line — Am, C, D, F — so a line is four bars.
    barsPerLine: 4,
    meter: "6/8",
    // A line's worth, as Auto would count — written down so it stays four if the line length moves.
    fixture: RISING_SUN,
  },
  {
    title: "Постой, паровоз",
    // In C#m rather than the usual Am — an inside joke, and why it opens on scale degrees: the
    // numerals read the same in any key.
    key: "C#m",
    tempo: 120,
    tempoUnit: "quarter",
    // Four bars of 2/4 to a line: room for its one to three chords at a walking pace.
    barsPerLine: 4,
    meter: "2/4",
    displayMode: "nashville",
    fixture: POSTOY_PAROVOZ,
  },
];

/**
 * Which fixtures a new library is given (ADR-076, ADR-080, ADR-089).
 *
 * The Rising Sun, and Постой, паровоз for Russian speakers: a song each audience already knows, one
 * in 6/8 and one in 2/4. The other fixtures stay — they are what the acceptance tests play — but a
 * first run is a welcome, not a test suite.
 */
const SEEDED = new Set(["House of the Rising Sun", "Постой, паровоз"]);

function build(source: ExampleSource): Song {
  return createSong({
    title: source.title,
    originalKey: source.key,
    currentKey: source.key,
    tempo: source.tempo,
    tempoUnit: source.tempoUnit,
    barsPerLine: source.barsPerLine,
    meter: source.meter,
    displayMode: source.displayMode ?? "full",
    rows: rowsFromPastedText(source.fixture.trim()),
  });
}

/** Builds a fresh copy of every development fixture, with new ids every call. */
export function createFixtureSongs(): Song[] {
  return SOURCES.map(build);
}

/** Builds a fresh copy of the songs a new library starts with, with new ids every call. */
export function createExampleSongs(): Song[] {
  return SOURCES.filter((source) => SEEDED.has(source.title)).map(build);
}
