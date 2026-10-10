/**
 * Everything that touches the Firebase SDK.
 *
 * Reached only through the dynamic import in `firebase.ts`, so the SDK lands in its own chunk and
 * never in the main bundle (ADR-023). Nothing else in the app imports this file directly.
 */
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  GoogleAuthProvider,
  OAuthProvider,
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
  const { idToken } = await nativeCredential(() => FirebaseAuthentication.signInWithGoogle());
  await signInWithCredential(appAuth, GoogleAuthProvider.credential(idToken));
}

/**
 * Signs in with Apple, in the iOS app only (ADR-103).
 *
 * The same hand-over as Google's: the plugin gets Apple's ID token, and the JS SDK signs in with
 * it. Apple's token is bound to a nonce the plugin made, so the raw nonce has to come across too, or
 * Firebase rejects the token as replayed.
 */
export async function signInWithApple(): Promise<void> {
  if (!app) throw new Error('not initialised');
  const appAuth = getAppAuth(app);
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const { idToken, nonce } = await nativeCredential(() => FirebaseAuthentication.signInWithApple());
  if (!nonce) throw new Error('Apple returned no nonce');
  const credential = new OAuthProvider('apple.com').credential({ idToken, rawNonce: nonce });
  await signInWithCredential(appAuth, credential);
}

/** Runs a native sign-in and returns its credential, with a cancel spoken in the web's terms. */
async function nativeCredential(
  signIn: () => Promise<{ credential: { idToken?: string; nonce?: string } | null }>
): Promise<{ idToken: string; nonce?: string }> {
  let credential: { idToken?: string; nonce?: string } | null;
  try {
    credential = (await signIn()).credential;
  } catch (cause) {
    // As a closed popup, so `useAuth` stays as quiet about it as it does on the web.
    if (isCancelledSignIn(cause)) {
      throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
    }
    throw cause;
  }
  if (!credential?.idToken) throw new Error('The sign-in returned no ID token');
  return { idToken: credential.idToken, nonce: credential.nonce };
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
