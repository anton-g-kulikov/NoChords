import { useState } from 'react';
import { Player } from './components/Player';
import { SongEditor } from './components/SongEditor';
import { Pencil } from 'lucide-react';
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
  } = useSongLibrary(auth.user?.uid ?? null, auth.loading);
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
        <SongList
        songs={songs}
        loading={loading}
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
        {/* The app's own row: back, name, edit — the two controls at the edges where a native
            title bar puts them, and the name centred between them (ADR-045). */}
        <div className="song-view__bar">
          <button
            type="button"
            className="button button--icon"
            aria-label="Back to songs"
            title="Back to songs"
            onClick={() => setOpenSongId(null)}
          >
            ←
          </button>

          <span className="song-view__app">NoChords</span>

          {/* One button rather than two segments (ADR-043): editing is a thing you enter and
              leave, not one of two equal places. */}
          <button
            type="button"
            className={
              pane === 'edit'
                ? 'button button--icon pane-toggle pane-toggle--editing'
                : 'button button--icon pane-toggle'
            }
            aria-pressed={pane === 'edit'}
            aria-label={pane === 'edit' ? 'Done editing' : 'Edit song'}
            title={pane === 'edit' ? 'Done editing' : 'Edit song'}
            onClick={() => setPane(pane === 'edit' ? 'play' : 'edit')}
          >
            <Pencil size={20} aria-hidden />
          </button>
        </div>

        {/* A row of its own, so a long title never squeezes the controls or wraps around them
            (ADR-045). Edited where it is read (ADR-038), and only while editing. */}
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
