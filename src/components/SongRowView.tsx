import { chordSymbolFor, rowSegments } from '../lib/display';
import { occurrenceKey } from '../lib/learning';
import type { DisplayMode, Song, SongRow } from '../types/song';

interface SongRowViewProps {
  row: SongRow;
  song: Song;
  mode: DisplayMode;
  /** Occurrence keys to conceal, as `rowId:chordIndex`. */
  concealed: Set<string>;
}

/**
 * Renders one row as chord-over-lyric segments.
 *
 * Each segment is a single box holding a chord and the lyric text it sits over, so the chord's
 * position is set by the lyric beneath it. A concealed chord keeps its real text and its box and is
 * only blurred — nothing is removed or substituted — so neither its own lyric nor any later chord
 * or lyric moves when concealment changes (ADR-007).
 */
export function SongRowView({ row, song, mode, concealed }: SongRowViewProps) {
  return (
    <div className="line">
      {rowSegments(row).map((segment, index) => {
        const hidden =
          segment.chordIndex !== null && concealed.has(occurrenceKey(row.id, segment.chordIndex));

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
    </div>
  );
}
