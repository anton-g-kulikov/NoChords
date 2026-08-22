/**
 * Firebase configuration, and lazy loaders for the SDK (ADR-022, ADR-023).
 *
 * Nothing here imports the Firebase SDK statically. The config alone is a few hundred bytes, so
 * `isFirebaseConfigured()` can answer synchronously — and the ~180kB of SDK is fetched only if
 * someone actually signs in.
 *
 * These values are public by design. A web config identifies the project and grants nothing on its
 * own; what protects a user's songs is `firestore.rules`, enforced server-side against their uid.
 */
import type { SongStore } from './storage';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: 'nochords-18219.firebaseapp.com',
  projectId: 'nochords-18219',
  storageBucket: 'nochords-18219.firebasestorage.app',
  messagingSenderId: '399674392616',
  appId: '1:399674392616:web:cb1a3f6d802f05db05351d',
};

/** Whether there is enough configuration to talk to Firebase at all. */
export function isFirebaseConfigured(): boolean {
  return config.apiKey !== '' && config.projectId !== '';
}

/** A signed-in person, kept minimal so Firebase types stay out of the component tree. */
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
}

type FirebaseModule = typeof import('./firebaseClient');

/** Loads the Firebase-facing module, or null if unconfigured or the chunk cannot be fetched. */
async function loadClient(): Promise<FirebaseModule | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const client = await import('./firebaseClient');
    return client.init(config) ? client : null;
  } catch {
    // Offline on first sign-in, or a blocked chunk: the app stays on local storage.
    return null;
  }
}

/** Subscribes to sign-in state. Resolves to an unsubscribe, or null when unavailable. */
export async function watchAuth(
  onUser: (user: AuthUser | null) => void
): Promise<(() => void) | null> {
  const client = await loadClient();
  return client ? client.watchAuth(onUser) : null;
}

export async function signInWithGoogle(): Promise<void> {
  const client = await loadClient();
  if (!client) throw new Error('offline');
  await client.signInWithGoogle();
}

export async function signOutNow(): Promise<void> {
  const client = await loadClient();
  if (client) await client.signOutNow();
}

/** A Firestore-backed store for this user, or null when unavailable. */
export async function loadCloudStore(uid: string): Promise<SongStore | null> {
  const client = await loadClient();
  return client ? client.createStore(uid) : null;
}
