/**
 * Checks firestore.rules against the Firestore emulator (ADR-108).
 *
 *   npx firebase-tools emulators:start --only firestore --project demo-nochords
 *   npm run test:rules
 *
 * Writes are built by the app's own songToDoc, so the rule is tested against exactly what the app
 * sends — and against what versions still cached on phones send, which must keep saving until they
 * update. The emulator accepts unsigned tokens, so each request can be any user.
 */
import { songToDoc } from '../src/lib/songDoc.ts';
import { createSong } from '../src/lib/songs.ts';

const BASE = 'http://127.0.0.1:8080/v1/projects/demo-nochords/databases/(default)/documents';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid: string) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ sub: uid, user_id: uid, iss: 'https://securetoken.google.com/demo-nochords', aud: 'demo-nochords', iat: 1, exp: 9999999999, auth_time: 1, firebase: { sign_in_provider: 'google.com' } }) + '.';

type V = Record<string, unknown>;
const value = (v: unknown): V => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, value(x)])) } };
};
const write = async (uid: string, owner: string, id: string, doc: object) => {
  const r = await fetch(`${BASE}/users/${owner}/songs/${id}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token(uid), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: (value(doc) as any).mapValue.fields }) });
  return r.status;
};
const call = async (method: string, uid: string, owner: string, id: string) => (await fetch(`${BASE}/users/${owner}/songs/${id}`, { method, headers: { Authorization: 'Bearer ' + token(uid) } })).status;

const song = createSong({ title: 'Test', openedAt: 1760000000000 });
const doc = songToDoc({ ...song, rows: [...song.rows, { ...song.rows[0], id: 'r2', lyrics: 'There [Am]is', chords: [{ symbol: 'Am', index: 6 }], bars: 2, meter: '3/4' }] });
const id = doc.id;
const { displayMode: _d, openedAt: _o, barsPerLine: _b, ...legacyCore } = doc as any;
const cases: Array<[string, number, () => Promise<number>]> = [
  ['a song this version writes', 200, () => write('alice', 'alice', id, doc)],
  ['the same song updated', 200, () => write('alice', 'alice', id, { ...doc, title: 'Renamed', openedAt: 1760000000001 })],
  ['openedAt null', 200, () => write('alice', 'alice', id, { ...doc, openedAt: null })],
  ['an older version with countInBars and beatsPerLine, no barsPerLine/displayMode/openedAt', 200, () => write('alice', 'alice', id, { ...legacyCore, countInBars: 2, beatsPerLine: 8 })],
  ['a field that is not a song field', 403, () => write('alice', 'alice', id, { ...doc, evil: 'x' })],
  ['a 201-character title', 403, () => write('alice', 'alice', id, { ...doc, title: 'x'.repeat(201) })],
  ['a 200-character title', 200, () => write('alice', 'alice', id, { ...doc, title: 'x'.repeat(200) })],
  // The rule counts characters, as the app does, so a Cyrillic title has the same 200.
  ['a 200-character Cyrillic title', 200, () => write('alice', 'alice', id, { ...doc, title: 'ж'.repeat(200) })],
  ['a 201-character Cyrillic title', 403, () => write('alice', 'alice', id, { ...doc, title: 'ж'.repeat(201) })],
  ['tempo 1e6', 403, () => write('alice', 'alice', id, { ...doc, tempo: 1000000 })],
  ['barsPerLine 1e9', 403, () => write('alice', 'alice', id, { ...doc, barsPerLine: 1000000000 })],
  ['an id that is not the document id', 403, () => write('alice', 'alice', id, { ...doc, id: 'other' })],
  ['missing rows', 403, () => write('alice', 'alice', id, (({ rows, ...rest }) => rest)(doc as any))],
  ['1001 rows', 403, () => write('alice', 'alice', id, { ...doc, rows: Array.from({ length: 1001 }, () => doc.rows[0]) })],
  ['1000 rows', 200, () => write('alice', 'alice', id, { ...doc, rows: Array.from({ length: 1000 }, () => doc.rows[0]) })],
  ['writing into another user', 403, () => write('alice', 'bob', id, doc)],
  ['reading your own', 200, () => call('GET', 'alice', 'alice', id)],
  ["reading another user's", 403, () => call('GET', 'bob', 'alice', id)],
  ["deleting another user's", 403, () => call('DELETE', 'bob', 'alice', id)],
  ['deleting your own', 200, () => call('DELETE', 'alice', 'alice', id)],
];
let failed = 0;
for (const [name, want, run] of cases) {
  const got = await run();
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${got} (want ${want})  ${name}`);
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
