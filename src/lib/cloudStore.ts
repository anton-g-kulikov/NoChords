/**
 * A `SongStore` backed by Firestore (ADR-021).
 *
 * Songs live at `users/{uid}/songs/{songId}`, one document each: a single document holding the
 * library would hit the 1MB limit and would rewrite every song on every edit. Ownership is a path
 * segment rather than a field, so no document can claim to belong to someone else and the rules
 * stay a one-liner.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { songFromDoc, songToDoc } from './songDoc';
import type { SongStore } from './storage';
import type { Song } from '../types/song';

/** Where one user's songs live. */
function songsCollection(db: Firestore, uid: string) {
  return collection(db, 'users', uid, 'songs');
}

/** Reads a query snapshot into songs, dropping anything that is not one. */
function readSongs(docs: Array<{ data(): unknown }>): Song[] {
  const songs: Song[] = [];
  for (const snapshot of docs) {
    const song = songFromDoc(snapshot.data());
    if (song) songs.push(song);
  }
  return songs;
}

export function createCloudSongStore(db: Firestore, uid: string): SongStore {
  return {
    async load(): Promise<Song[]> {
      const snapshot = await getDocs(songsCollection(db, uid));
      return readSongs(snapshot.docs);
    },

    async saveSong(song: Song): Promise<void> {
      await setDoc(doc(db, 'users', uid, 'songs', song.id), songToDoc(song));
    },

    async deleteSong(songId: string): Promise<void> {
      await deleteDoc(doc(db, 'users', uid, 'songs', songId));
    },

    async clear(): Promise<void> {
      const snapshot = await getDocs(songsCollection(db, uid));
      await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
    },

    /** Live updates, so a song written on one device turns up on another. */
    subscribe(onChange: (songs: Song[]) => void): () => void {
      return onSnapshot(
        songsCollection(db, uid),
        (snapshot) => onChange(readSongs(snapshot.docs)),
        () => {
          // A permission or network error should not take the app down; the cache keeps serving.
        }
      );
    },
  };
}
