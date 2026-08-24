/**
 * The song library: local when signed out, Firestore when signed in (ADR-020, ADR-021).
 *
 * The component tree talks to this hook and never to a store directly, which is what let the
 * backend arrive without the UI changing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSongStore, defaultStorage, type SongStore } from '../lib/storage';
import { loadCloudStore } from '../lib/firebase';
import {
  hasUnfinishedImport,
  markImportUnfinished,
  missingFromAccount,
  shouldOfferImport,
} from '../lib/cloudImport';
import { hasSeededExamples, markExamplesSeeded, shouldSeedExamples } from '../lib/firstRun';
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
  /** Set when an import did not carry everything up, naming how much is still behind (ADR-031). */
  importError: { missingCount: number } | null;
  addSong(): Song;
  updateSong(song: Song): void;
  deleteSong(songId: string): void;
  acceptImport(): Promise<void>;
  dismissImport(): void;
}

export function useSongLibrary(uid: string | null): SongLibrary {
  const storage = useMemo(() => defaultStorage(), []);
  const localStore = useMemo(() => createSongStore(storage), [storage]);

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
  const [importError, setImportError] = useState<{ missingCount: number } | null>(null);

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

        // A device library that has never been through this starts with the examples (ADR-024).
        let initial = loaded;
        if (!cloudStore) {
          const seeded = hasSeededExamples(storage);
          if (shouldSeedExamples(seeded, loaded.length)) {
            const examples = createExampleSongs();
            for (const song of examples) await localStore.saveSong(song).catch(() => {});
            if (cancelled) return;
            initial = examples;
          }
          if (!seeded) markExamplesSeeded(storage);
        }

        setSongs(initial);
        setLoading(false);

        // Signing in to an empty account with songs on the device: ask before uploading (ADR-022).
        // An import that did not finish asks again, however full the account looks — otherwise the
        // songs it left behind have no way up, since the offer is only made into an empty one.
        if (cloudStore) {
          const local = await localStore.load();
          const unfinished = hasUnfinishedImport(storage);
          if (!cancelled && local.length > 0) {
            if (shouldOfferImport(local.length, loaded.length) || unfinished) {
              const missing = missingFromAccount(
                local.map((song) => song.id),
                loaded.map((song) => song.id)
              );
              if (missing.length > 0) setImportOffer({ localCount: missing.length });
              else markImportUnfinished(storage, false);
            }
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
  }, [store, cloudStore, localStore, storage]);

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

  /**
   * Copies the device's songs into the account, and checks that they arrived (ADR-031).
   *
   * Every write used to be wrapped in a `catch` that discarded the error, so a partial import was
   * indistinguishable from a complete one: the prompt vanished, some songs did not, and nothing
   * said so. Now the offer stays until the account actually holds them.
   */
  const acceptImport = useCallback(async () => {
    setImportError(null);
    const local = await localStore.load();
    // Remembered before writing, not after: a reload mid-import must still know to ask again.
    markImportUnfinished(storage, true);

    for (const song of local) {
      // One song failing must not stop the others, but it must not pass unnoticed either — the
      // check below is what notices.
      await storeRef.current.saveSong(song).catch(() => {});
    }

    const after = await storeRef.current.load().catch(() => [] as Song[]);
    const missing = missingFromAccount(
      local.map((song) => song.id),
      after.map((song) => song.id)
    );
    setSongs(after);

    if (missing.length === 0) {
      markImportUnfinished(storage, false);
      setImportOffer(null);
      return;
    }
    // Left standing deliberately: the songs are still on the device, and the offer is the way back.
    setImportError({ missingCount: missing.length });
    setImportOffer({ localCount: missing.length });
  }, [localStore, storage]);

  const dismissImport = useCallback(() => {
    setImportOffer(null);
    setImportError(null);
    // Declining is an answer, not a failure: stop asking on every load.
    markImportUnfinished(storage, false);
  }, [storage]);

  return {
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
  };
}
