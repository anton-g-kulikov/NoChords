import { concealmentFor } from '../lib/learning';
import type { Song } from '../types/song';

interface SongListProps {
  songs: Song[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onDelete: (songId: string) => void;
  onLoadExamples: () => void;
}

export function SongList({ songs, onOpen, onCreate, onDelete, onLoadExamples }: SongListProps) {
  return (
    <div className="library">
      <div className="library__head">
        <h1>NoChords</h1>
        <div className="library__actions">
          <button type="button" className="button" onClick={onLoadExamples}>
            Add example songs
          </button>
          <button type="button" className="button button--primary" onClick={onCreate}>
            New song
          </button>
        </div>
      </div>

      {songs.length === 0 ? (
        <p className="library__empty">
          No songs yet. Create one and type your lines with chords in brackets —{' '}
          <code>[Am]There is a [C]house in New [D]Orleans,</code> — or add the example songs to see
          how it works.
        </p>
      ) : (
        <ul className="library__list">
          {songs.map((song) => (
            <li key={song.id} className="library__item">
              <button type="button" className="library__open" onClick={() => onOpen(song.id)}>
                <span className="library__title">{song.title || 'Untitled song'}</span>
                <span className="library__meta">
                  {song.originalKey}
                  {song.currentKey !== song.originalKey ? ` → ${song.currentKey}` : ''} ·{' '}
                  {song.tempo} bpm · {song.rows.length} line
                  {song.rows.length === 1 ? '' : 's'} ·{' '}
                  {Math.round(concealmentFor(song.learningPlaythrough) * 100)}% learned
                </span>
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                aria-label={`Delete ${song.title || 'Untitled song'}`}
                onClick={() => {
                  if (window.confirm(`Delete “${song.title || 'Untitled song'}”?`)) {
                    onDelete(song.id);
                  }
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
