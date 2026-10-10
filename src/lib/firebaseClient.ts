/**
 * Everything that touches the Firebase SDK.
 *
 * Reached only through the dynamic import in `firebase.ts`, so the SDK lands in its own chunk and
 * never in the main bundle (ADR-023). Nothing else in the app imports this file directly.
 */
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { createCloudSongStore } from './cloudStore';
import { isNative } from './native';
import type { AuthUser } from './firebase';
import type { SongStore } from './storage';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/** Starts the SDK. Returns false if it cannot start, so callers fall back to local storage. */
export function init(config: FirebaseOptions): boolean {
  if (app) return true;
  try {
    app = getApps()[0] ?? initializeApp(config);
    return true;
  } catch {
    return false;
  }
}

/**
 * Firestore with its offline cache on.
 *
 * The cache matters as much as the sync: a phone in a rehearsal room may have no signal, and this
 * app worked offline before it had a backend. It should not lose that by gaining one.
 */
function getDb(): Firestore | null {
  if (db) return db;
  if (!app) return null;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return null;
  }
  return db;
}

/**
 * Auth, started the way the platform can finish.
 *
 * `getAuth` also loads Google's sign-in iframe from the auth domain, and in the iOS shell — whose
 * page is `capacitor://localhost` — that never completes, so the first auth state never arrives
 * and the library waits on it forever. The shells start auth without it. Popup sign-in cannot work
 * there anyway: Google refuses OAuth inside an embedded web view.
 */
function getAppAuth(firebaseApp: FirebaseApp): Auth {
  if (auth) return auth;
  auth = isNative()
    ? initializeAuth(firebaseApp, { persistence: indexedDBLocalPersistence })
    : getAuth(firebaseApp);
  return auth;
}

export function watchAuth(onUser: (user: AuthUser | null) => void): () => void {
  if (!app) return () => {};
  return onAuthStateChanged(
    getAppAuth(app),
    (user) =>
      onUser(
        user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null
      ),
    () => onUser(null)
  );
}

export async function signInWithGoogle(): Promise<void> {
  if (!app) throw new Error('not initialised');
  await signInWithPopup(getAppAuth(app), new GoogleAuthProvider());
}

export async function signOutNow(): Promise<void> {
  if (!app) return;
  await signOut(getAppAuth(app));
}

export function createStore(uid: string): SongStore | null {
  const database = getDb();
  return database ? createCloudSongStore(database, uid) : null;
}
