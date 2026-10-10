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
  deleteUser,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  revokeAccessToken,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import {
  collection,
  getDocs,
  initializeFirestore,
  writeBatch,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { createCloudSongStore } from './cloudStore';
import { isCancelledSignIn, isNative } from './native';
import type { SignInProvider } from './account';
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
        user
          ? {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              provider: providerOf(user),
            }
          : null
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

  await signInWithCredential(appAuth, (await nativeCredential('google')).credential);
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
  await signInWithCredential(getAppAuth(app), (await nativeCredential('apple')).credential);
}

/**
 * A fresh credential from the platform's own sign-in, for the JS SDK to sign in or reauthenticate
 * with, and a cancel spoken in the web's terms.
 *
 * Apple also hands over an authorization code, the one thing that can revoke its sign-in, which
 * deleting an account has to do (ADR-105).
 */
async function nativeCredential(
  provider: SignInProvider
): Promise<{ credential: AuthCredential; authorizationCode?: string }> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  let result: { idToken?: string; nonce?: string; authorizationCode?: string } | null;
  try {
    result = (
      await (provider === 'apple'
        ? FirebaseAuthentication.signInWithApple()
        : FirebaseAuthentication.signInWithGoogle())
    ).credential;
  } catch (cause) {
    // As a closed popup, so `useAuth` stays as quiet about it as it does on the web.
    if (isCancelledSignIn(cause)) {
      throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
    }
    throw cause;
  }
  if (!result?.idToken) throw new Error('The sign-in returned no ID token');
  if (provider === 'google') return { credential: GoogleAuthProvider.credential(result.idToken) };
  // Apple's token is bound to the nonce the plugin made; without the raw one Firebase refuses it.
  if (!result.nonce) throw new Error('Apple returned no nonce');
  return {
    credential: new OAuthProvider('apple.com').credential({
      idToken: result.idToken,
      rawNonce: result.nonce,
    }),
    authorizationCode: result.authorizationCode,
  };
}

/** Which of the offered sign-ins this account uses, or null for anything else. */
function providerOf(user: User): SignInProvider | null {
  const ids = user.providerData.map((info) => info.providerId);
  if (ids.includes('apple.com')) return 'apple';
  if (ids.includes('google.com')) return 'google';
  return null;
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

/**
 * Deletes the signed-in account and every song in it, for good (ADR-105).
 *
 * In this order, so a failure part-way leaves something that can simply be tried again:
 *
 * 1. Sign in once more, with the same account. Firebase deletes only a recently signed-in user,
 *    and asking again is also the proof that it is the owner deleting it, not whoever has the phone.
 * 2. Delete the songs, while the rules still let this user touch them.
 * 3. For Apple, revoke the sign-in, as Apple requires of an app that deletes an account. It needs
 *    Apple's key in Firebase; without it this fails, and the account is deleted regardless, because
 *    keeping data someone asked to delete is the worse failure.
 * 4. Delete the user, and on a phone, Google's session with it.
 */
export async function deleteAccount(): Promise<void> {
  if (!app) throw new Error('not initialised');
  const appAuth = getAppAuth(app);
  const user = appAuth.currentUser;
  if (!user) throw new Error('not signed in');
  const provider = providerOf(user);
  if (!provider) throw new Error('unsupported sign-in');

  let authorizationCode: string | undefined;
  if (isNative()) {
    const fresh = await nativeCredential(provider);
    await reauthenticateWithCredential(user, fresh.credential);
    authorizationCode = fresh.authorizationCode;
  } else {
    await reauthenticateWithPopup(
      user,
      provider === 'apple' ? new OAuthProvider('apple.com') : new GoogleAuthProvider()
    );
  }

  const database = getDb();
  if (!database) throw new Error('no database');
  const songs = await getDocs(collection(database, 'users', user.uid, 'songs'));
  // A batch holds at most 500 writes.
  for (let start = 0; start < songs.docs.length; start += 500) {
    const batch = writeBatch(database);
    for (const song of songs.docs.slice(start, start + 500)) batch.delete(song.ref);
    await batch.commit();
  }

  if (provider === 'apple' && authorizationCode) {
    await revokeAccessToken(appAuth, authorizationCode).catch(() => {});
  }

  await deleteUser(user);
  if (isNative()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut().catch(() => {});
  }
}

export function createStore(uid: string): SongStore | null {
  const database = getDb();
  return database ? createCloudSongStore(database, uid) : null;
}
