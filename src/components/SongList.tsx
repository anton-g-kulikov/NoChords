import { useState, type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import type { AccountAction } from '../lib/account';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { MAX_LEVEL, levelFor } from '../lib/learning';
import type { Song } from '../types/song';
import { tempoUnitSymbol } from '../lib/tempo';
import { withSigns } from '../lib/chordType';
import type { ThemePreference } from '../lib/theme';
import { ThemeSwitch } from './ThemeSwitch';
import { Mark } from './Mark';
import {
  LANGUAGE_FILTERS,
  effectiveLanguageFilter,
  filterByLanguage,
  offersLanguageChoice,
  type LanguageFilter,
} from '../lib/language';

/** Where "Buy me a [song] book" goes (ADR-079). */
const SUPPORT_URL = 'https://buymeacoffee.com/antonkulikov';

/** The public song archive: songs to copy into a library, and where to share one (ADR-090). */
const SONGS_URL = 'https://github.com/anton-g-kulikov/nochords-songs';

interface SongListProps {
  songs: Song[];
  /** Signing in or out, and the run for it. Null when there is no account to act on. */
  authAction: (AccountAction & { run: () => void }) | null;
  /** Anything the library has to say right now — an import offer, a sign-in error. */
  notice?: ReactNode;
  /** True until it is known whose songs these are (ADR-062). */
  loading: boolean;
  onOpen: (songId: string) => void;
  onCreate: () => void;
  onOpenGuide: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  /** Steps the second ink on, from the mark (ADR-072). */
  onNextAccent: () => void;
  /** The ink now on, for the mark's label. */
  accentLabel: string;
  /** Which songs to list, by language; remembered on this device (ADR-081). */
  language: LanguageFilter;
  onLanguageChange: (language: LanguageFilter) => void;
}

export function SongList({
  songs,
  notice,
  loading,
  onOpen,
  onCreate,
  authAction,
  onOpenGuide,
  theme,
  onThemeChange,
  onNextAccent,
  accentLabel,
  language,
  onLanguageChange,
}: SongListProps) {
  const install = useInstallPrompt();
  /* Only a tap strikes the note: arriving at the library is not a change of ink. */
  const [struck, setStruck] = useState(false);
  // Only a library with songs in two languages has anything to choose between (ADR-081).
  const languageChoice = offersLanguageChoice(songs);
  const shownLanguage = effectiveLanguageFilter(language, songs);
  const shown = filterByLanguage(songs, shownLanguage);

  return (
    <div className="screen library">
      {/*
       * One row rather than three bands (ADR-064): the app's name, where its songs are kept, and
       * the one thing you came here to do. The library used to spend a third of a phone screen
       * introducing itself before the first song.
       */}
      {/*
       * The name, and signing in — which belongs up here, where you look when you arrive on a new
       * device (ADR-064). Making a song is the thing you came for, so it gets its own full width
       * below rather than competing for room in this row.
       */}
      <div className="screen__head library__head">
        <span className="library__brand">
          {/* The app's own mark, in this page's colours rather than the home screen's; the same
              drawing as the installed icons, held to it by a test (ADR-064, ADR-070). */}
          {/* An easter egg (ADR-072): tapping the mark steps the second ink through seven. Keyed on
              the ink, so the note is struck afresh — and animates — on every change. */}
          <button
            type="button"
            className="library__mark"
            aria-label={`Ink: ${accentLabel}. Tap for the next one.`}
            onClick={() => {
              setStruck(true);
              onNextAccent();
            }}
          >
            <Mark key={accentLabel} className={struck ? 'library__note--struck' : undefined} />
          </button>
          <Wordmark />
        </span>
        {authAction &&
          (authAction.kind === 'sign-out' ? (
            <button
              type="button"
              className="button button--icon library__signin"
              aria-label={authAction.label}
              title={authAction.label}
              onClick={authAction.run}
            >
              <LogOut size={20} aria-hidden />
            </button>
          ) : (
            <button type="button" className="button library__signin" onClick={authAction.run}>
              {authAction.label}
            </button>
          ))}
      </div>

      <div className="library__create">
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
        <>
        <div
          className={
            languageChoice ? 'library__heading library__heading--languages' : 'library__heading'
          }
        >
          <h2 className="library__heading-text">
            Songs <span className="library__count">{shown.length}</span>
          </h2>
          {/* In the running head, as the head's own type: a contents page that can be read in
              either language, not a control panel over it (ADR-081). */}
          {languageChoice && (
            <div className="library__languages" role="group" aria-label="Song language">
              {LANGUAGE_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    option.value === shownLanguage
                      ? 'library__language library__language--active'
                      : 'library__language'
                  }
                  aria-pressed={option.value === shownLanguage}
                  onClick={() => onLanguageChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* A contents page (ADR-068): the title, what it is, and the key where a page number
            would be — the thing you look for before you play. */}
        <ul className="library__list">
          {shown.map((song) => (
            <li key={song.id} className="library__item">
              <button type="button" className="library__open" onClick={() => onOpen(song.id)}>
                <span className="library__text">
                  <span className="library__title">{song.title || 'Untitled song'}</span>
                  <span className="library__meta">
                    {/* `♩ = 90`, not `90 bpm`: the number means nothing without the note (ADR-052). */}
                    {tempoUnitSymbol(song.tempoUnit)} = {song.tempo} · {song.rows.length} line
                    {song.rows.length === 1 ? '' : 's'} · level {levelFor(song.learningPlaythrough)}{' '}
                    of {MAX_LEVEL}
                  </span>
                </span>
                <span
                  className="library__key"
                  title={
                    song.currentKey !== song.originalKey
                      ? `Written in ${song.originalKey}, played in ${song.currentKey}`
                      : `In ${song.originalKey}`
                  }
                >
                  {withSigns(song.currentKey)}
                  {song.currentKey !== song.originalKey && (
                    <span className="library__key-from">from {withSigns(song.originalKey)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        </>
      )}

      </div>

      {/* Outside the scroller, so it holds the bottom of the screen however long the list is
          (ADR-037 — the shell already works this way for the player's transport). */}
      <footer className="library__foot">
        {/*
         * Three rows, each one kind of thing (ADR-071): where to read more, how the app looks on
         * this device, and which build it is. The account line that used to lead it repeated the
         * header's button in words, and is gone.
         */}
        <p className="library__links">
          <button type="button" className="library__install" onClick={onOpenGuide}>
            Bars, beats and meter
          </button>
          {' · '}
          {/* Named for what you go for — songs to play — rather than for where they are kept. */}
          <a className="library__install" href={SONGS_URL} target="_blank" rel="noopener noreferrer">
            More songs
          </a>
          {' · '}
          {/* Support, in the app's own notation (ADR-079): the brackets are where a chord goes. */}
          <a className="library__install" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Buy me a <span className="library__bracket">[</span>song
            <span className="library__bracket">]</span> book
          </a>
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

        {/* With the other things that belong to this device rather than to a song (ADR-067). */}
        <ThemeSwitch value={theme} onChange={onThemeChange} />

        {/* Which build this is. The service worker keys its cache on the same number, so this is
            also how you tell whether an installed app has picked up a release yet (ADR-028). */}
        <p className="library__version">v{__APP_VERSION__}</p>
      </footer>
    </div>
  );
}

/**
 * The name as type rather than as an image (ADR-068): "No" in the second ink, "Chords" in ink, both
 * upright — the mark beside it carries the logo's one slant (ADR-074).
 */
export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark__no">No</span>Chords
    </span>
  );
}
