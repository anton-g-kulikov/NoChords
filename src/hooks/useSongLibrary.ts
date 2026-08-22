/**
 * The song library, persisted to local storage on every change.
 *
 * The component tree talks to this hook, never to `localStorage` — the store is the seam a
 * backend would replace (ADR-005).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSongStore } from '../lib/storage';
import { createExampleSongs } from '../lib/examples';
import { createSong } from '../lib/songs';
import type { Song } from '../types/song';

export interface SongLibrary {
  songs: Song[];
  addSong(): Song;
  addExampleSongs(): void;
  updateSong(song: Song): void;
  deleteSong(songId: string): void;
}

export function useSongLibrary(): SongLibrary {
  const store = useMemo(() => createSongStore(), []);
  const [songs, setSongs] = useState<Song[]>(() => store.load());

  // Skip the write that would otherwise fire immediately after the initial load.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    store.save(songs);
  }, [songs, store]);

  const addSong = useCallback((): Song => {
    const song = createSong({ title: 'Untitled song' });
    setSongs((current) => [...current, song]);
    return song;
  }, []);

  const addExampleSongs = useCallback(() => {
    setSongs((current) => [...current, ...createExampleSongs()]);
  }, []);

  const updateSong = useCallback((song: Song) => {
    setSongs((current) => current.map((item) => (item.id === song.id ? song : item)));
  }, []);

  const deleteSong = useCallback((songId: string) => {
    setSongs((current) => current.filter((item) => item.id !== songId));
  }, []);

  return { songs, addSong, addExampleSongs, updateSong, deleteSong };
}
