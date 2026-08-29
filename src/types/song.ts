/**
 * Core domain types.
 *
 * These shapes are the persistence contract: everything here must stay JSON-serialisable so a
 * song can round-trip through `localStorage` today and through a backend later without the UI
 * changing (see `_meta/architecture-decisions.md` ADR-005).
 */
import type { TempoUnit } from '../lib/tempo';

/**
 * One chord, anchored to the character in the lyric it is played over (ADR-007).
 *
 * Rows are written inline as `[Dm]O, where are you [C]going?`; that notation is parsed into
 * anchors by `lib/inline.ts`, which is also what renders them back into the editor's text.
 */
export interface ChordAnchor {
  /** Chord symbol as written, spelled in the song's `originalKey` (ADR-001). */
  symbol: string;
  /** Character offset into the row's `lyrics` where this chord falls. */
  index: number;
}

/** A single lyric line together with the chords played over it. */
export interface SongRow {
  id: string;
  /** The lyric line, with no chord or timing markup. May be empty for spacer rows. */
  lyrics: string;
  /** Chords over this line, ordered by `index`. */
  chords: ChordAnchor[];
  /**
   * How many bars this line lasts, written inline as `|2|` (ADR-032).
   * A bar's length comes from the meter in effect here. `null` means the song's `barsPerLine`.
   */
  bars: number | null;
  /**
   * A time signature taking effect at this line and running until the next one, written inline
   * as `{4/4}` (ADR-026). `null` means the line stays in whatever meter is already running.
   */
  meter: string | null;
}

/** A song: metadata plus its ordered rows. */
export interface Song {
  id: string;
  title: string;
  /** The key the stored chord symbols are written in. Never changed by transposition. */
  originalKey: string;
  /** The key chords are displayed in. A view setting only. */
  currentKey: string;
  /** The tempo number driving playback: this many `tempoUnit`s a minute. */
  tempo: number;
  /** The note value the tempo counts — `♪`, `♩` or `♩.` (ADR-052). */
  tempoUnit: TempoUnit;
  /** Default length of a line in bars; a line may override it with `|n|` (ADR-032). */
  barsPerLine: number;
  /** The song's time signature, e.g. `6/8`. Sets bar length and the accent pulse (ADR-026). */
  meter: string;
  /** Completed learning playthroughs, saturating at `CONCEALMENT_STAGES.length - 1`. */
  learningPlaythrough: number;
  rows: SongRow[];
}

/** How chords are rendered during playback. */
export type DisplayMode = 'full' | 'nashville' | 'learning';
