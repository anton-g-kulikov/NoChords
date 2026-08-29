import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { concealmentFor } from '../lib/learning';
import type { Song } from '../types/song';
import { tempoUnitSymbol } from '../lib/tempo';

interface SongListProps {
  songs: Song[];
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onDelete: (songId: string) => void;
  /** Null when signing in is unavailable or already done. */
  onSignIn: (() => void) | null;
  onOpenGuide: () => void;
}

export function SongList({
  songs,
  onOpen,
  onCreate,
  onDelete,
  onSignIn,
  onOpenGuide,
}: SongListProps) {
  const install = useInstallPrompt();

  return (
    <div className="screen library">
      <div className="screen__head library__head">
        <h1>NoChords</h1>
        <div className="library__actions">
          {onSignIn && (
            <button type="button" className="button" onClick={onSignIn}>
              Log in to Sync
            </button>
          )}
          <button type="button" className="button button--primary" onClick={onCreate}>
            New song
          </button>
        </div>
      </div>

      <div className="screen__scroll">
      {songs.length === 0 ? (
        <p className="library__empty">
          No songs yet. Create one and type your lines with chords in brackets, like{' '}
          <code>There [Am]is a [C]house in New [D]Orleans</code>.
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
                  {/* `♩ = 90`, not `90 bpm`: the number means nothing without the note (ADR-052). */}
                  {tempoUnitSymbol(song.tempoUnit)} = {song.tempo} · {song.rows.length} line
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

      {/* Which build this is. The service worker keys its cache on the same number, so this is
          also how you tell whether an installed app has picked up a release yet (ADR-028). */}
      <p className="library__version">
        <button type="button" className="library__install" onClick={onOpenGuide}>
          Bars, beats and meter
        </button>
        {' · '}v{__APP_VERSION__}
        {install.affordance === 'prompt' && (
          <>
            {' · '}
            <button type="button" className="library__install" onClick={install.install}>
              Install app
            </button>
          </>
        )}
        {/* iOS offers no way to ask, so the app can only say where the button is (ADR-029). */}
        {install.affordance === 'ios-share' && <> · Share → Add to Home Screen to install</>}
      </p>
      </div>
    </div>
  );
}
