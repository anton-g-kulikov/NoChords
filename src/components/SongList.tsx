import { useState, type ReactNode } from 'react';
import { CircleUserRound } from 'lucide-react';
import type { AccountAction } from '../lib/account';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { MAX_LEVEL, levelFor } from '../lib/learning';
import type { Song } from '../types/song';
import { tempoUnitSymbol } from '../lib/tempo';
import { withSigns } from '../lib/chordType';
import type { ThemePreference } from '../lib/theme';
import { ThemeSwitch } from './ThemeSwitch';
import { Bracket } from './Mark';
import {
  LANGUAGE_FILTERS,
  effectiveLanguageFilter,
  filterByLanguage,
  offersLanguageChoice,
  type LanguageFilter,
} from '../lib/language';
import { LIBRARY_SORTS, sortSongs, type LibrarySort } from '../lib/librarySort';

/** Where "Buy me a [song] book" goes (ADR-079). */
const SUPPORT_URL = 'https://buymeacoffee.com/antonkulikov';

/** The public song archive: songs to copy into a library, and where to share one (ADR-090). */
const SONGS_URL = 'https://github.com/anton-g-kulikov/nochords-songs';

/** Where to write for help, forwarded to the maker (ADR-102). */
const HELP_EMAIL = 'help@nochords.app';

/** The site's own pages, so they have one public address the stores can point at too (ADR-102). */
const LICENCE_URL = 'https://nochords.app/licence/';
const PRIVACY_URL = 'https://nochords.app/privacy/';

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
  /** The order the list is in: last opened first, or by title; remembered on this device (ADR-106). */
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
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
  sort,
  onSortChange,
}: SongListProps) {
  const install = useInstallPrompt();
  /* Only a tap strikes the note: arriving at the library is not a change of ink. */
  const [struck, setStruck] = useState(false);
  // Only a library with songs in two languages has anything to choose between (ADR-081).
  const languageChoice = offersLanguageChoice(songs);
  const shownLanguage = effectiveLanguageFilter(language, songs);
  const shown = sortSongs(filterByLanguage(songs, shownLanguage), sort);

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
        {/*
         * The name in its brackets (ADR-100), and an easter egg (ADR-072): tapping it steps the
         * second ink through seven. Keyed on the ink, so the brackets are struck afresh — and
         * animate — on every change.
         */}
        <button
          type="button"
          className="library__brand"
          aria-label={`NoChords. Ink: ${accentLabel}. Tap for the next one.`}
          onClick={() => {
            setStruck(true);
            onNextAccent();
          }}
        >
          <Wordmark
            bracketKey={accentLabel}
            bracketClassName={struck ? 'wordmark__bracket--struck' : undefined}
          />
        </button>
        {authAction &&
          (authAction.kind === 'account' ? (
            <button
              type="button"
              className="button button--icon library__signin"
              aria-label={authAction.label}
              title={authAction.label}
              onClick={authAction.run}
            >
              <CircleUserRound size={20} aria-hidden />
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
          className="library__heading library__heading--controls"
        >
          <h2 className="library__heading-text">
            Songs <span className="library__count">{shown.length}</span>
          </h2>
          {/* Beside the count it orders, in the head's own type like the languages (ADR-106). */}
          <div className="library__sorts" role="group" aria-label="Order">
            {LIBRARY_SORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.hint}
                className={
                  option.value === sort
                    ? 'library__language library__language--active'
                    : 'library__language'
                }
                aria-pressed={option.value === sort}
                onClick={() => onSortChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
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
         * Rows, each one kind of thing (ADR-071, ADR-098): the app's own links, the links beyond it,
         * how the app looks on this device, and which build it is. The account line that used to
         * lead it repeated the header's button in words, and is gone.
         */}
        {/* Lines, each one kind of link: the app itself — how to read it, how to install it — then
            what lies beyond it, more songs and support; then help and the small print (ADR-098,
            ADR-102). */}
        <p className="library__links">
          <button type="button" className="library__install" onClick={onOpenGuide}>
            Bars, beats and meter
          </button>
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
        <p className="library__links">
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
        </p>
        <p className="library__links">
          <a className="library__install" href={`mailto:${HELP_EMAIL}`}>
            {HELP_EMAIL}
          </a>
          {' · '}
          <a className="library__install" href={LICENCE_URL} target="_blank" rel="noopener noreferrer">
            Licence
          </a>
          {' · '}
          <a className="library__install" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
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
 * The logo: the name in its brackets, `[ NoChords ]` (ADR-100). `[Am]` is how a chord is written in
 * the app, so the name sits where a chord would go. The brackets carry the second ink and the logo's
 * one slant; the name is set upright, in ink, as one word (ADR-068, ADR-074).
 */
export function Wordmark({
  bracketKey,
  bracketClassName,
}: {
  /** Changing it remounts the brackets, which replays their animation. */
  bracketKey?: string;
  bracketClassName?: string;
}) {
  const bracket = ['wordmark__bracket', bracketClassName].filter(Boolean).join(' ');
  return (
    <span className="wordmark">
      <Bracket key={`open-${bracketKey}`} side="open" className={bracket} />
      <span className="wordmark__name">NoChords</span>
      <Bracket key={`close-${bracketKey}`} side="close" className={bracket} />
    </span>
  );
}
