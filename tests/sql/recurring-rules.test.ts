// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { asUser, newDb } from './harness';

const A = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@x.com' };
const B = { id: '00000000-0000-0000-0000-00000000000b', email: 'b@x.com' };
let db: PGlite;
let hA: string;
let catA: string;

const item = (key: string | null) =>
  db.query(
    `insert into recurring_items (household_id, kind, name, amount_agorot, day_of_month, interval_months, start_month, paid_by, installment_key)
     values ($1, 'fixed', 'x', 100, 1, 1, '2026-11-01', 'card', $2) on conflict (household_id, installment_key) do nothing`,
    [hA, key],
  );

beforeEach(async () => {
  db = await newDb();
  await db.query(`insert into auth.users values ($1,$2),($3,$4)`, [A.id, A.email, B.id, B.email]);
  await db.exec(`insert into allowlist values ('a@x.com'), ('b@x.com')`);
  await asUser(db, A.id, A.email);
  hA = (await db.query<{ id: string }>(`select create_household('בית', 'שי') id`)).rows[0].id;
  catA = (await db.query<{ id: string }>(`select id from categories where household_id = $1 limit 1`, [hA])).rows[0].id;
  await asUser(db, B.id, B.email);
  await db.query(`select create_household('אחר', 'בי')`);
});

test('installment_key is unique per household and upsert ignores a duplicate', async () => {
  await asUser(db, A.id, A.email);
  await item('inst:1111:2026-06-22:x:10');
  await item('inst:1111:2026-06-22:x:10');
  await item(null);
  await item(null);
  expect((await db.query(`select count(*)::int n from recurring_items`)).rows[0]).toEqual({ n: 3 });
});

test('category_rules and recurring_dismissals are visible only to members', async () => {
  await asUser(db, A.id, A.email);
  await db.query(`insert into category_rules (household_id, merchant_key, category_id) values ($1, 'express', $2)`, [hA, catA]);
  await db.query(`insert into recurring_dismissals (household_id, merchant_key) values ($1, 'express')`, [hA]);
  expect((await db.query(`select count(*)::int n from category_rules`)).rows[0]).toEqual({ n: 1 });
  await asUser(db, B.id, B.email);
  expect((await db.query(`select count(*)::int n from category_rules`)).rows[0]).toEqual({ n: 0 });
  expect((await db.query(`select count(*)::int n from recurring_dismissals`)).rows[0]).toEqual({ n: 0 });
  await expect(db.query(`insert into recurring_dismissals (household_id, merchant_key) values ($1, 'y')`, [hA])).rejects.toThrow();
});

test('end_month defaults to null and variable_amount to false', async () => {
  await asUser(db, A.id, A.email);
  await item(null);
  expect((await db.query(`select end_month, variable_amount from recurring_items`)).rows).toEqual([{ end_month: null, variable_amount: false }]);
});

test('merchant_key defaults to null', async () => {
  await asUser(db, A.id, A.email);
  await item(null);
  expect((await db.query(`select merchant_key from recurring_items`)).rows).toEqual([{ merchant_key: null }]);
});
