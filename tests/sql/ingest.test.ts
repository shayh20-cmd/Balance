// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { asAdmin, asUser, newDb } from './harness';

const A = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@x.com' };
const B = { id: '00000000-0000-0000-0000-00000000000b', email: 'b@x.com' };
let db: PGlite;
let householdA: string;
let token: string;

const RLM = String.fromCharCode(0x200f);
const text = (amount: string) => `עסקה בסך ${amount} ₪ בכרטיס לאומי מאסטרקארד פלטינה ••5218`;

async function asAnon() {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', '', false)`);
  await db.exec('set role anon');
}

const ingest = (tok: string, title: string, body: string) =>
  db.query<{ r: string }>(`select ingest_notification($1, $2, $3) r`, [tok, title, body]).then((x) => x.rows[0].r);

beforeEach(async () => {
  db = await newDb();
  await db.query(`insert into auth.users values ($1,$2),($3,$4)`, [A.id, A.email, B.id, B.email]);
  await db.exec(`insert into allowlist values ('a@x.com'), ('b@x.com')`);
  await asUser(db, A.id, A.email);
  householdA = (await db.query<{ id: string }>(`select create_household('בית', 'שי') id`)).rows[0].id;
  token = (await db.query<{ t: string }>(`select create_device('הטלפון של שי') t`)).rows[0].t;
});

test('a Google Wallet notification becomes a pending expense for the device owner', async () => {
  await asAnon();
  expect(await ingest(token, 'GINGIN MARKET', text('41.64'))).toBe('ok');
  await asUser(db, A.id, A.email);
  const rows = (await db.query(`select merchant, amount_agorot, kind, source, status, member_id, card_last4, household_id from transactions`)).rows;
  expect(rows).toEqual([{
    merchant: 'GINGIN MARKET', amount_agorot: 4164, kind: 'expense', source: 'google_wallet', status: 'pending',
    member_id: A.id, card_last4: '5218', household_id: householdA,
  }]);
});

test('amounts with thousands separators and bidi marks are read', async () => {
  await asAnon();
  expect(await ingest(token, `${RLM}SHUFERSAL${RLM}`, `${RLM}עסקה בסך ${RLM}1,234.50 ₪${RLM} בכרטיס לאומי ••5218`)).toBe('ok');
  await asUser(db, A.id, A.email);
  expect((await db.query(`select merchant, amount_agorot from transactions`)).rows).toEqual([{ merchant: 'SHUFERSAL', amount_agorot: 123450 }]);
});

test('the same notification sent twice is recorded once', async () => {
  await asAnon();
  expect(await ingest(token, 'SHUMSUM KONKORD', text('51.62'))).toBe('ok');
  expect(await ingest(token, 'SHUMSUM KONKORD', text('51.62'))).toBe('duplicate');
  await asUser(db, A.id, A.email);
  expect((await db.query(`select count(*)::int n from transactions`)).rows[0]).toEqual({ n: 1 });
});

test('an unreadable notification goes to the inbox, not lost', async () => {
  await asAnon();
  expect(await ingest(token, 'Google Wallet', 'הכרטיס שלך מוכן לשימוש')).toBe('inbox');
  await asUser(db, A.id, A.email);
  expect((await db.query(`select count(*)::int n from transactions`)).rows[0]).toEqual({ n: 0 });
  expect((await db.query(`select title, body, source from ingest_inbox`)).rows).toEqual([
    { title: 'Google Wallet', body: 'הכרטיס שלך מוכן לשימוש', source: 'google_wallet' },
  ]);
});

test('a wrong or revoked token is rejected', async () => {
  await asAnon();
  await expect(ingest('not-a-token', 'X', text('10'))).rejects.toThrow(/invalid_token/);
  await asUser(db, A.id, A.email);
  await db.query(`update devices set revoked_at = now()`);
  await asAnon();
  await expect(ingest(token, 'X', text('10'))).rejects.toThrow(/invalid_token/);
});

test('anon cannot read devices or the inbox, and sees no transactions', async () => {
  await asAnon();
  await ingest(token, 'GINGIN MARKET', text('41.64'));
  await expect(db.query(`select * from devices`)).rejects.toThrow(/permission denied/);
  await expect(db.query(`select * from ingest_inbox`)).rejects.toThrow(/permission denied/);
  expect((await db.query(`select * from transactions`)).rows).toHaveLength(0);
});

test("another household can't see a household's devices", async () => {
  await asUser(db, B.id, B.email);
  await db.query(`select create_household('בית ב', 'ב')`);
  expect((await db.query(`select * from devices`)).rows).toHaveLength(0);
  await asAdmin(db);
  expect((await db.query(`select count(*)::int n from devices`)).rows[0]).toEqual({ n: 1 });
});

test('create_device needs a household', async () => {
  await asUser(db, B.id, B.email);
  await expect(db.query(`select create_device('x')`)).rejects.toThrow(/not_member/);
});
