import { chordSymbolFor, rowSegments } from '../lib/display';
import { parseMeter } from '../lib/meter';
import { occurrenceKey } from '../lib/learning';
import type { DisplayMode, Song, SongRow } from '../types/song';

interface SongRowViewProps {
  row: SongRow;
  song: Song;
  mode: DisplayMode;
  /** Occurrence keys to conceal, as `rowId:chordIndex`. */
  concealed: Set<string>;
  /** While true this line's concealed chords are shown anyway (ADR-018). */
  revealed?: boolean;
}

/**
 * Renders one row as chord-over-lyric segments.
 *
 * Each segment is a single box holding a chord and the lyric text it sits over, so the chord's
 * position is set by the lyric beneath it. A concealed chord keeps its real text and its box and is
 * only blurred — nothing is removed or substituted — so neither its own lyric nor any later chord
 * or lyric moves when concealment changes (ADR-007).
 */
export function SongRowView({ row, song, mode, concealed, revealed = false }: SongRowViewProps) {
  return (
    <div className="line">
      {/*
       * A line that changes the meter says so before its first chord, where a score puts a new
       * time signature — the change applies from here, and reading it after the bar it governs
       * would be reading it too late (ADR-061).
       */}
      {row.meter !== null && parseMeter(row.meter) !== null && (
        <span className="line__meter" title={`${row.meter} from here`}>
          {row.meter}
        </span>
      )}

      {rowSegments(row).map((segment, index) => {
        const hidden =
          !revealed &&
          segment.chordIndex !== null &&
          concealed.has(occurrenceKey(row.id, segment.chordIndex));

        return (
          <span key={index} className="seg">
            <span
              className={hidden ? 'seg__chord seg__chord--concealed' : 'seg__chord'}
              aria-label={hidden ? 'hidden chord' : undefined}
            >
              {segment.chord ? chordSymbolFor(segment.chord.symbol, song, mode) : ' '}
            </span>
            <span className="seg__lyric">{segment.text || ' '}</span>
          </span>
        );
      })}

      {/*
       * A line that runs longer or shorter than the song's default says so, as a small numeral
       * after the last word (ADR-061).
       *
       * Inside the line rather than in the margin, so it is part of what the type scale is fitted
       * to (ADR-054): a note that floats over the text can be overlapped by it, and this one
       * cannot be.
       */}
      {row.bars !== null && row.bars > 0 && row.bars !== song.barsPerLine && (
        <span className="line__bars" title={`${row.bars} bars`}>
          {row.bars}
        </span>
      )}
    </div>
  );
}
