import { useState } from 'react';
import { Player } from './components/Player';
import { SongEditor } from './components/SongEditor';
import { NotationGuide } from './components/NotationGuide';
import { SongList } from './components/SongList';
import { AuthBar } from './components/AuthBar';
import { ImportPrompt } from './components/ImportPrompt';
import { useSongLibrary } from './hooks/useSongLibrary';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';

type Pane = 'edit' | 'play';

export function App() {
  const auth = useAuth();
  const {
    songs,
    loading,
    storedIn,
    importOffer,
    importError,
    addSong,
    updateSong,
    deleteSong,
    acceptImport,
    dismissImport,
  } = useSongLibrary(auth.user?.uid ?? null);
  const { settings, update: updateSettings } = useSettings();
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  // Opening an existing song lands on Play; only a brand new song starts in Edit.
  const [pane, setPane] = useState<Pane>('play');

  const song = songs.find((item) => item.id === openSongId) ?? null;

  if (showGuide) return <NotationGuide onClose={() => setShowGuide(false)} />;

  if (!song) {
    return (
      <>
        <AuthBar auth={auth} storedIn={storedIn} />
        {importOffer && (
          <ImportPrompt
            localCount={importOffer.localCount}
            error={importError}
            onAccept={() => void acceptImport()}
            onDismiss={dismissImport}
          />
        )}
        {loading && <p className="library__empty">Loading your songs…</p>}
        <SongList
        songs={songs}
        onOpen={(songId) => {
          setOpenSongId(songId);
          setPane('play');
        }}
        onCreate={() => {
          setOpenSongId(addSong().id);
          setPane('edit');
        }}
        onDelete={deleteSong}
        onOpenGuide={() => setShowGuide(true)}
        onSignIn={
          auth.available && !auth.loading && !auth.user ? () => void auth.signIn() : null
        }
        />
      </>
    );
  }

  return (
    <div className="screen song-view">
      <header className="screen__head song-view__head">
        {/* The arrow is the whole message, and the title beside it says where you are. */}
        <button
          type="button"
          className="button button--icon"
          aria-label="Back to songs"
          title="Back to songs"
          onClick={() => setOpenSongId(null)}
        >
          ←
        </button>
        {/* Edited where it is read, rather than in a field further down the page (ADR-038).
            Only while editing: in Play a stray tap on the title should do nothing. */}
        {pane === 'edit' ? (
          <input
            className="song-view__title song-view__title--input"
            value={song.title}
            placeholder="Untitled song"
            aria-label="Song title"
            onChange={(event) => updateSong({ ...song, title: event.target.value })}
          />
        ) : (
          <h1 className="song-view__title">{song.title || 'Untitled song'}</h1>
        )}
        <div className="controls__group" role="group" aria-label="Pane">
          <button
            type="button"
            aria-pressed={pane === 'edit'}
            className={pane === 'edit' ? 'segment segment--active' : 'segment'}
            onClick={() => setPane('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            aria-pressed={pane === 'play'}
            className={pane === 'play' ? 'segment segment--active' : 'segment'}
            onClick={() => setPane('play')}
          >
            Play
          </button>
        </div>
      </header>

      {pane === 'edit' ? (
        <div className="screen__scroll">
          <SongEditor song={song} onChange={updateSong} onOpenGuide={() => setShowGuide(true)} />
        </div>
      ) : (
        <Player
          song={song}
          onChange={updateSong}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      )}
    </div>
  );
}
