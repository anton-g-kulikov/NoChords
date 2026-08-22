/**
 * The song library: local when signed out, Firestore when signed in (ADR-020, ADR-021).
 *
 * The component tree talks to this hook and never to a store directly, which is what let the
 * backend arrive without the UI changing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSongStore, type SongStore } from '../lib/storage';
import { loadCloudStore } from '../lib/firebase';
import { shouldOfferImport } from '../lib/cloudImport';
import { createExampleSongs } from '../lib/examples';
import { createSong } from '../lib/songs';
import type { Song } from '../types/song';

/**
 * How long editing settles before a write goes out.
 *
 * Every keystroke in the song text area produces a new song. Against `localStorage` that is free;
 * against Firestore it would be a document write per keystroke — cost, quota, and contention.
 */
const WRITE_DEBOUNCE_MS = 800;

export interface SongLibrary {
  songs: Song[];
  /** True until the first load finishes, so the library does not flash empty. */
  loading: boolean;
  /** Where songs are being kept right now. */
  storedIn: 'local' | 'cloud';
  /** Set when signing in found local songs and an empty account (ADR-022). */
  importOffer: { localCount: number } | null;
  addSong(): Song;
  addExampleSongs(): void;
  updateSong(song: Song): void;
  deleteSong(songId: string): void;
  acceptImport(): Promise<void>;
  dismissImport(): void;
}

export function useSongLibrary(uid: string | null): SongLibrary {
  const localStore = useMemo(() => createSongStore(), []);

  /**
   * The cloud store, or null when signed out or Firebase is unavailable.
   * Resolved asynchronously because the SDK is fetched on demand (ADR-023).
   */
  const [cloudStore, setCloudStore] = useState<SongStore | null>(null);
  useEffect(() => {
    if (!uid) {
      setCloudStore(null);
      return undefined;
    }
    let cancelled = false;
    void loadCloudStore(uid).then((created) => {
      if (!cancelled) setCloudStore(created);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const store = cloudStore ?? localStore;
  const storedIn = cloudStore ? 'cloud' : 'local';

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOffer, setImportOffer] = useState<{ localCount: number } | null>(null);

  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // Load whenever the store changes — that is, on mount and on sign in or out.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    store
      .load()
      .then(async (loaded) => {
        if (cancelled) return;
        setSongs(loaded);
        setLoading(false);

        // Signing in to an empty account with songs on the device: ask before uploading (ADR-022).
        if (cloudStore) {
          const local = await localStore.load();
          if (!cancelled && shouldOfferImport(local.length, loaded.length)) {
            setImportOffer({ localCount: local.length });
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSongs([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [store, cloudStore, localStore]);

  /** Songs edited but not yet written, so a remote snapshot cannot overwrite them mid-edit. */
  const pendingWrites = useRef(new Map<string, Song>());
  const flushTimer = useRef<number | null>(null);

  // Live updates from other devices, where the store offers them.
  useEffect(() => {
    if (!store.subscribe) return undefined;
    return store.subscribe((next) => {
      // Never clobber local edits that have not been written yet.
      if (pendingWrites.current.size > 0) return;
      setSongs(next);
    });
  }, [store]);

  const flush = useCallback(() => {
    const pending = [...pendingWrites.current.values()];
    pendingWrites.current.clear();
    for (const song of pending) {
      void storeRef.current.saveSong(song).catch(() => {
        // A failed write leaves the song in memory; Firestore's cache retries when it can.
      });
    }
  }, []);

  const queueWrite = useCallback(
    (song: Song) => {
      pendingWrites.current.set(song.id, song);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(flush, WRITE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Do not lose the last few keystrokes when the page goes away.
  useEffect(() => {
    const onHide = () => {
      if (pendingWrites.current.size > 0) flush();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const addSong = useCallback((): Song => {
    const song = createSong({ title: 'Untitled song' });
    setSongs((current) => [...current, song]);
    queueWrite(song);
    return song;
  }, [queueWrite]);

  const addExampleSongs = useCallback(() => {
    const examples = createExampleSongs();
    setSongs((current) => [...current, ...examples]);
    for (const song of examples) queueWrite(song);
  }, [queueWrite]);

  const updateSong = useCallback(
    (song: Song) => {
      setSongs((current) => current.map((item) => (item.id === song.id ? song : item)));
      queueWrite(song);
    },
    [queueWrite]
  );

  const deleteSong = useCallback((songId: string) => {
    setSongs((current) => current.filter((item) => item.id !== songId));
    pendingWrites.current.delete(songId);
    void storeRef.current.deleteSong(songId).catch(() => {});
  }, []);

  const acceptImport = useCallback(async () => {
    setImportOffer(null);
    const local = await localStore.load();
    for (const song of local) {
      await storeRef.current.saveSong(song).catch(() => {});
    }
    setSongs(await storeRef.current.load());
  }, [localStore]);

  const dismissImport = useCallback(() => setImportOffer(null), []);

  return {
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
  };
}
