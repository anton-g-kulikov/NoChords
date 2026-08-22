import { useState } from 'react';
import { Player } from './components/Player';
import { SongEditor } from './components/SongEditor';
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
    addSong,
    addExampleSongs,
    updateSong,
    deleteSong,
    acceptImport,
    dismissImport,
  } = useSongLibrary(auth.user?.uid ?? null);
  const { settings, update: updateSettings } = useSettings();
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('edit');

  const song = songs.find((item) => item.id === openSongId) ?? null;

  if (!song) {
    return (
      <>
        <AuthBar auth={auth} storedIn={storedIn} />
        {importOffer && (
          <ImportPrompt
            localCount={importOffer.localCount}
            onAccept={() => void acceptImport()}
            onDismiss={dismissImport}
          />
        )}
        {loading && <p className="library__empty">Loading your songs…</p>}
        <SongList
        songs={songs}
        onOpen={(songId) => {
          setOpenSongId(songId);
          setPane('edit');
        }}
        onCreate={() => {
          setOpenSongId(addSong().id);
          setPane('edit');
        }}
        onDelete={deleteSong}
        onLoadExamples={addExampleSongs}
        />
      </>
    );
  }

  return (
    <div className="song-view">
      <header className="song-view__head">
        <button type="button" className="button" onClick={() => setOpenSongId(null)}>
          ← Songs
        </button>
        <h1 className="song-view__title">{song.title || 'Untitled song'}</h1>
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
        <SongEditor song={song} onChange={updateSong} />
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
