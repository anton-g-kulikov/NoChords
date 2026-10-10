import { useState } from 'react';
import { Player } from './components/Player';
import { SongEditor } from './components/SongEditor';
import { ArrowLeft, Check, Pencil } from 'lucide-react';
import { NotationGuide } from './components/NotationGuide';
import { SongList, Wordmark } from './components/SongList';
import { accountAction, accountState, signInProviders } from './lib/account';
import { nativePlatform } from './lib/native';
import { ImportPrompt } from './components/ImportPrompt';
import { SignInChoice } from './components/SignInChoice';
import { AccountCard } from './components/AccountCard';
import { useSongLibrary } from './hooks/useSongLibrary';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { ACCENTS, nextAccent } from './lib/accent';

type Pane = 'edit' | 'play';

export function App() {
  const auth = useAuth();
  const {
    songs,
    loading,
    importOffer,
    importError,
    addSong,
    updateSong,
    deleteSong,
    acceptImport,
    dismissImport,
  } = useSongLibrary(auth.user?.uid ?? null, auth.loading);
  const { settings, update: updateSettings } = useSettings();
  useTheme(settings.theme, settings.accent);
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  // Opening an existing song lands on Play; only a brand new song starts in Edit.
  const [pane, setPane] = useState<Pane>('play');

  const song = songs.find((item) => item.id === openSongId) ?? null;

  /* One reading of the account, shared by the header's button and the footer's line (ADR-064). */
  const account = accountState(auth.available, auth.loading, auth.user !== null);
  const action = accountAction(account);
  /* With one way to sign in, Sign in takes it; with more, it asks which first (ADR-103). */
  const providers = signInProviders(nativePlatform());
  const [choosingSignIn, setChoosingSignIn] = useState(false);
  /* Signed in, the header's button opens the account card instead (ADR-105). */
  const [accountOpen, setAccountOpen] = useState(false);

  if (showGuide) return <NotationGuide onClose={() => setShowGuide(false)} />;

  if (!song) {
    return (
      <>
        <SongList
        songs={songs}
        notice={
          <>
            {importOffer && (
              <ImportPrompt
                localCount={importOffer.localCount}
                error={importError}
                onAccept={() => void acceptImport()}
                onDismiss={dismissImport}
              />
            )}
            {choosingSignIn && account === 'signed-out' && (
              <SignInChoice
                providers={providers}
                onChoose={(provider) => {
                  setChoosingSignIn(false);
                  void auth.signIn(provider);
                }}
                onDismiss={() => setChoosingSignIn(false)}
              />
            )}
            {accountOpen && account === 'signed-in' && (
              <AccountCard
                email={auth.user?.email ?? null}
                provider={auth.user?.provider ?? null}
                songCount={songs.length}
                onSignOut={() => {
                  setAccountOpen(false);
                  void auth.signOutNow();
                }}
                onDelete={async () => {
                  const gone = await auth.deleteAccount();
                  if (gone) setAccountOpen(false);
                  return gone;
                }}
                onClose={() => setAccountOpen(false)}
              />
            )}
            {auth.error && <p className="library__error">{auth.error}</p>}
            {auth.notice && <p className="library__notice">{auth.notice}</p>}
          </>
        }
        loading={loading}
        onOpen={(songId) => {
          // Stamped as it opens, so the library's "Recent" order puts it first (ADR-106).
          const opened = songs.find((candidate) => candidate.id === songId);
          if (opened) updateSong({ ...opened, openedAt: Date.now() });
          setOpenSongId(songId);
          setPane('play');
        }}
        onCreate={() => {
          setOpenSongId(addSong().id);
          setPane('edit');
        }}
        authAction={
          action === null
            ? null
            : {
                ...action,
                run: () => {
                  if (action.kind === 'account') setAccountOpen((open) => !open);
                  else if (providers.length === 1) void auth.signIn(providers[0]);
                  else setChoosingSignIn((open) => !open);
                },
              }
        }
        onOpenGuide={() => setShowGuide(true)}
        theme={settings.theme}
        onThemeChange={(theme) => updateSettings({ theme })}
        onNextAccent={() => updateSettings({ accent: nextAccent(settings.accent) })}
        accentLabel={ACCENTS[settings.accent].label}
        language={settings.libraryLanguage}
        onLanguageChange={(libraryLanguage) => updateSettings({ libraryLanguage })}
        sort={settings.librarySort}
        onSortChange={(librarySort) => updateSettings({ librarySort })}
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
            <ArrowLeft size={20} aria-hidden />
          </button>

          <span className="song-view__app">
            <Wordmark />
          </span>

          {/* One button rather than two segments (ADR-043): editing is a thing you enter and
              leave, not one of two equal places. While editing it is the way out, so it says so —
              a check, as a title bar's save does — rather than staying a pencil that means "edit"
              while you already are (ADR-092). The song saves as it is typed; this one leaves. */}
          <button
            type="button"
            className={
              pane === 'edit'
                ? 'button button--icon pane-toggle pane-toggle--editing'
                : 'button button--icon pane-toggle'
            }
            aria-label={pane === 'edit' ? 'Save' : 'Edit song'}
            title={pane === 'edit' ? 'Save' : 'Edit song'}
            onClick={() => setPane(pane === 'edit' ? 'play' : 'edit')}
          >
            {pane === 'edit' ? <Check size={20} aria-hidden /> : <Pencil size={20} aria-hidden />}
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
          <SongEditor
            song={song}
            onChange={updateSong}
            onOpenGuide={() => setShowGuide(true)}
            /* Deleting the song you are in leaves nothing to edit, so it hands you back the
               library rather than an editor with no song (ADR-063). */
            onDelete={() => {
              deleteSong(song.id);
              setOpenSongId(null);
            }}
          />
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
