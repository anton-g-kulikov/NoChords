import type { ReactNode } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { MAX_LEVEL, levelFor } from '../lib/learning';
import type { Song } from '../types/song';
import { tempoUnitSymbol } from '../lib/tempo';

interface SongListProps {
  songs: Song[];
  /** The account line, composed by the app and shown at the foot of the list (ADR-064). */
  account: ReactNode;
  /** Anything the library has to say right now — an import offer, a sign-in error. */
  notice?: ReactNode;
  /** True until it is known whose songs these are (ADR-062). */
  loading: boolean;
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onOpenGuide: () => void;
}

export function SongList({
  songs,
  account,
  notice,
  loading,
  onOpen,
  onCreate,
  onOpenGuide,
}: SongListProps) {
  const install = useInstallPrompt();

  return (
    <div className="screen library">
      {/*
       * One row rather than three bands (ADR-064): the app's name, where its songs are kept, and
       * the one thing you came here to do. The library used to spend a third of a phone screen
       * introducing itself before the first song.
       */}
      <div className="screen__head library__head">
        <span className="library__brand">NoChords</span>
        <button
          type="button"
          className="button button--primary library__new"
          onClick={onCreate}
        >
          New song
        </button>
      </div>

      {/* Under the header rather than above the screen: a notice is about this library, and a
          band stacked over the whole app was how the header got to be three rows deep. */}
      {notice}

      <div className="screen__scroll">
      {/* One body at a time: a list rendered while the account is still answering is a list that
          gets replaced on screen a moment later (ADR-062). */}
      {loading ? (
        <p className="library__empty">Loading your songs…</p>
      ) : songs.length === 0 ? (
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
                  level {levelFor(song.learningPlaythrough)} of {MAX_LEVEL}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* After the songs, where wondering whether they are anywhere else belongs (ADR-064). */}
      {account}

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
