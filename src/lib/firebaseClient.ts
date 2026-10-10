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
  signInWithCredential,
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
import { isCancelledSignIn, isNative } from './native';
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

/**
 * Signs in with Google: a popup on the web, the platform's own Google sign-in in the shells
 * (ADR-101).
 *
 * In a shell the plugin only fetches Google's ID token (`skipNativeAuth`, in
 * `capacitor.config.ts`), and the JS SDK signs in with it. That keeps the session where Firestore
 * and `watchAuth` already look, so nothing downstream knows which way someone signed in. The
 * plugin is imported only here, so the website never fetches it.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!app) throw new Error('not initialised');
  const appAuth = getAppAuth(app);
  if (!isNative()) {
    await signInWithPopup(appAuth, new GoogleAuthProvider());
    return;
  }

  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  let idToken: string | undefined;
  try {
    idToken = (await FirebaseAuthentication.signInWithGoogle()).credential?.idToken;
  } catch (cause) {
    // Spoken in the web's terms, so `useAuth` treats it as the closed popup it is.
    if (isCancelledSignIn(cause)) {
      throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
    }
    throw cause;
  }
  if (!idToken) throw new Error('Google returned no ID token');
  await signInWithCredential(appAuth, GoogleAuthProvider.credential(idToken));
}

export async function signOutNow(): Promise<void> {
  if (!app) return;
  if (isNative()) {
    // Google's own session too, or the next sign-in skips the account chooser and silently
    // picks whoever signed in last.
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut().catch(() => {});
  }
  await signOut(getAppAuth(app));
}

export function createStore(uid: string): SongStore | null {
  const database = getDb();
  return database ? createCloudSongStore(database, uid) : null;
}
