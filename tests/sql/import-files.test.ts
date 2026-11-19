// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { asUser, newDb } from './harness';

const A = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@x.com' };
const B = { id: '00000000-0000-0000-0000-00000000000b', email: 'b@x.com' };
let db: PGlite;
let hA: string;

beforeEach(async () => {
  db = await newDb();
  await db.query(`insert into auth.users values ($1,$2),($3,$4)`, [A.id, A.email, B.id, B.email]);
  await db.exec(`insert into allowlist values ('a@x.com'), ('b@x.com')`);
  await asUser(db, A.id, A.email);
  hA = (await db.query<{ id: string }>(`select create_household('בית', 'שי') id`)).rows[0].id;
  await asUser(db, B.id, B.email);
  await db.query(`select create_household('אחר', 'בי')`);
});

test('import_files is visible only to members', async () => {
  await asUser(db, A.id, A.email);
  await db.query(`insert into import_files (household_id, kind, card_last4, billing_month, row_count) values ($1, 'card', '7712', '2026-11-01', 82)`, [hA]);
  expect((await db.query(`select card_last4, row_count from import_files`)).rows).toEqual([{ card_last4: '7712', row_count: 82 }]);
  await asUser(db, B.id, B.email);
  expect((await db.query(`select count(*)::int n from import_files`)).rows[0]).toEqual({ n: 0 });
  await expect(db.query(`insert into import_files (household_id, kind) values ($1, 'card')`, [hA])).rejects.toThrow();
});

test('savings_goals is visible only to members and rejects a negative amount', async () => {
  await asUser(db, A.id, A.email);
  await db.query(`insert into savings_goals (household_id, month, amount_agorot) values ($1, '2026-11-01', 300000)`, [hA]);
  await expect(db.query(`insert into savings_goals (household_id, month, amount_agorot) values ($1, '2026-12-01', -1)`, [hA])).rejects.toThrow();
  await asUser(db, B.id, B.email);
  expect((await db.query(`select count(*)::int n from savings_goals`)).rows[0]).toEqual({ n: 0 });
});
