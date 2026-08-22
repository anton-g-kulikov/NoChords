# Example Songs

Development fixtures for the web MVP.

These fixtures use old traditional song texts rather than the specific
lyrics or arrangements of Simon & Garfunkel, Silly Wizard, or The
Animals. Chord placement, harmonization, timing, and formatting below
are original MVP test arrangements and are intentionally simple.

The inline format is:

`[Chord]lyric`

Each row also has an illustrative `duration` and `pause` value. These
values are starting points for testing the scrolling engine, not
authoritative performance timings.

---

## 1. Scarborough Fair

**Type:** Traditional English ballad\
**Test key:** D minor\
**Meter:** 3/4\
**Tempo:** 90 BPM\
**Purpose:** Minor/modal harmony, multiple chord changes per line,
Nashville conversion, transposition.

### Fixture

```text
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
```

### Expected relative representation

For the simplified D-minor fixture:

- `Dm` → `1m`
- `C` → `7`

The implementation may later adopt a more rigorous
Roman-numeral/Nashville convention for minor keys. The important MVP
test is that the relative representation remains stable when the song is
transposed.

---

## 2. If I Was a Blackbird

**Type:** Traditional folk song, Roud 387\
**Test key:** G major\
**Meter:** 3/4\
**Tempo:** 90 BPM\
**Purpose:** Straightforward major-key song, verse/chorus repetition,
common I-IV-V harmony.

### Fixture

```text
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
```

### Expected relative representation

- `G` → `1`
- `C` → `4`
- `D` → `5`

This is the cleanest fixture for testing Nashville mode.

---

## 3. House of the Rising Sun

**Type:** Traditional American folk/blues song\
**Test key:** A minor\
**Meter:** 6/8\
**Tempo:** 80 BPM\
**Purpose:** Classic-rock-adjacent demo, richer chord sequence, strong
learning-mode fixture.

For the MVP this fixture deliberately uses a compact traditional-text
test version rather than attempting to reproduce The Animals' 1964
arrangement.

### Fixture

```text
[Am]There is a [C]house in New [D]Orleans,
duration: 6 | pause: 0

[Am]They call the [E]Rising [Am]Sun,
duration: 6 | pause: 0

[Am]And it's been the [C]ruin of many a [D]poor boy,
duration: 6 | pause: 0

[Am]Dear God, I [E]know I was [Am]one.
duration: 6 | pause: 2

[Am]My mother was a [C]tailor,
duration: 6 | pause: 0

[Am]She sewed my new [D]blue jeans,
duration: 6 | pause: 0

[Am]And my father was a [C]gambler's man,
duration: 6 | pause: 0

[Am]Way down in [E]New Or[Am]leans.
duration: 6 | pause: 0

[Am]And the only [C]thing a gambler [D]needs,
duration: 6 | pause: 0

[Am]Is a suitcase and a [E]trunk,
duration: 6 | pause: 0

[Am]And the only time he's [C]satisfied,
duration: 6 | pause: 0

[Am]Is when he's a [E]drunk.
duration: 6 | pause: 2

[Am]Oh, mother, tell your [C]children,
duration: 6 | pause: 0

[Am]Not to do what I have [D]done,
duration: 6 | pause: 0

[Am]To spend your lives in [C]sin and misery,
duration: 6 | pause: 0

[Am]In the house of the [E]rising [Am]sun.
duration: 6 | pause: 2

[Am]I got one foot on the [C]platform,
duration: 6 | pause: 0

[Am]And another on the [D]train,
duration: 6 | pause: 0

[Am]And I'm going back to [C]New Orleans,
duration: 6 | pause: 0

[Am]To wear that [E]ball and [Am]chain.
duration: 6 | pause: 2

[Am]There is a [C]house in New [D]Orleans,
duration: 6 | pause: 0

[Am]They call the [E]Rising [Am]Sun,
duration: 6 | pause: 0

[Am]And it's been the [C]ruin of many a [D]poor boy,
duration: 6 | pause: 0

[Am]Dear God, I [E]know I was [Am]one.
duration: 6 | pause: 3

[Am]Dear God, I [E]know I was the [Am]one.
duration: 6 | pause: 3
```

### Expected relative representation

For A minor, the simplified fixture contains:

- `Am` → `1m`
- `C` → `3`
- `D` → `4`
- `E` → `5`

This fixture should contain enough individual chord occurrences for the
learning engine to visibly conceal 20%, 40%, 60%, 80%, and 100% across
repeated playthroughs.

---

## Acceptance Tests Using These Fixtures

### Parsing

Given:

```text
[G]I'd follow the ship that my [D]true love sails [G]in.
```

the parser should produce three chord occurrences while preserving the
complete lyric text and the position associated with each chord.

### Transposition

Transpose **If I Was a Blackbird** from G to A:

- `G` → `A`
- `C` → `D`
- `D` → `E`

Its relative representation must remain:

- `1`
- `4`
- `5`

### Learning Mode

For a fixture containing `N` chord occurrences:

- first learning playthrough conceals approximately 20%,
- second 40%,
- third 60%,
- fourth 80%,
- fifth and later 100%.

Round the requested number of concealed occurrences consistently.

The randomly selected concealed set must remain fixed for the duration
of one playthrough.

### Layout

Concealing a chord must not move:

- its associated lyric,
- subsequent chord positions,
- subsequent lyric text.

### Playback

Each fixture must:

1.  start from the first row;
2.  advance using `duration`;
3.  apply `pause` after the corresponding row;
4.  scroll the active row into view;
5.  complete cleanly after the final row.

---

## Source Notes

- **Scarborough Fair:** based on the traditional text published by
  Frank Kidson in _Traditional Tunes_ (1891), not the Simon &
  Garfunkel arrangement.
- **If I Was a Blackbird:** based on the traditional
  `I Am a Young Maiden` family (Roud 387), documented by George
  Gardiner in 1906. The fixture does not use the later Andy M.
  Stewart/Silly Wizard rewrite.
- **House of the Rising Sun:** traditional song with a printed version
  documented by Robert Winslow Gordon in 1925. The fixture is not a
  transcription of The Animals' arrangement.

The chord arrangements, chord placement, timing values, and application
formatting in this file were created specifically as development
fixtures.
