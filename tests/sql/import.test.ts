// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { asAdmin, asUser, newDb } from './harness';

const A = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@x.com' };
const B = { id: '00000000-0000-0000-0000-00000000000b', email: 'b@x.com' };
let db: PGlite;
let hA: string;
let hB: string;

const insertTxn = (hid: string, member: string, key: string | null) =>
  db.query(
    `insert into transactions (household_id, member_id, date, amount_agorot, kind, source, import_key)
     values ($1, $2, '2026-11-01', 100, 'expense', 'file', $3)`,
    [hid, member, key],
  );

beforeEach(async () => {
  db = await newDb();
  await db.query(`insert into auth.users values ($1,$2),($3,$4)`, [A.id, A.email, B.id, B.email]);
  await db.exec(`insert into allowlist values ('a@x.com'), ('b@x.com')`);
  await asUser(db, A.id, A.email);
  hA = (await db.query<{ id: string }>(`select create_household('בית', 'שי') id`)).rows[0].id;
  await asUser(db, B.id, B.email);
  hB = (await db.query<{ id: string }>(`select create_household('אחר', 'בי') id`)).rows[0].id;
});

test('a second insert with the same import_key in one household is rejected; a different household may reuse it', async () => {
  await asUser(db, A.id, A.email);
  await insertTxn(hA, A.id, 'card:1111:2026-11-01:100:x:0#1');
  await expect(insertTxn(hA, A.id, 'card:1111:2026-11-01:100:x:0#1')).rejects.toThrow();
  await insertTxn(hA, A.id, null);
  await insertTxn(hA, A.id, null);
  await asUser(db, B.id, B.email);
  await insertTxn(hB, B.id, 'card:1111:2026-11-01:100:x:0#1');
  await asAdmin(db);
  expect((await db.query(`select count(*)::int n from transactions`)).rows[0]).toEqual({ n: 4 });
});

test('an upsert on household_id,import_key ignores a duplicate', async () => {
  await asUser(db, A.id, A.email);
  const up = () =>
    db.query(
      `insert into transactions (household_id, member_id, date, amount_agorot, kind, source, import_key)
       values ($1, $2, '2026-11-01', 100, 'expense', 'file', 'k') on conflict (household_id, import_key) do nothing`,
      [hA, A.id],
    );
  await up();
  await up();
  expect((await db.query(`select count(*)::int n from transactions`)).rows[0]).toEqual({ n: 1 });
});

test('month_closes is visible only to members', async () => {
  await asUser(db, A.id, A.email);
  await db.query(`insert into month_closes (household_id, month, closed_by) values ($1, '2026-10-01', $2)`, [hA, A.id]);
  expect((await db.query(`select count(*)::int n from month_closes`)).rows[0]).toEqual({ n: 1 });
  await asUser(db, B.id, B.email);
  expect((await db.query(`select count(*)::int n from month_closes`)).rows[0]).toEqual({ n: 0 });
  await expect(db.query(`insert into month_closes (household_id, month) values ($1, '2026-09-01')`, [hA])).rejects.toThrow();
});

test('needs_review defaults to false', async () => {
  await asUser(db, A.id, A.email);
  await insertTxn(hA, A.id, null);
  expect((await db.query(`select needs_review, category_name_hint from transactions`)).rows).toEqual([
    { needs_review: false, category_name_hint: null },
  ]);
});
