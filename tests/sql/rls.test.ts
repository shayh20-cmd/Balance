// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { asAdmin, asUser, newDb } from './harness';

const A = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@x.com' };
const B = { id: '00000000-0000-0000-0000-00000000000b', email: 'b@x.com' };
const C = { id: '00000000-0000-0000-0000-00000000000c', email: 'c@x.com' };
let db: PGlite;

beforeEach(async () => {
  db = await newDb();
  await db.query(`insert into auth.users values ($1,$2),($3,$4),($5,$6)`, [A.id, A.email, B.id, B.email, C.id, C.email]);
  await db.exec(`insert into allowlist values ('a@x.com'), ('b@x.com')`);
});

const create = async (u: typeof A, name = 'בית') => {
  await asUser(db, u.id, u.email);
  return (await db.query<{ id: string }>(`select create_household($1, $2) as id`, [name, 'שם'])).rows[0].id;
};
const addTxn = (hid: string, member: string) =>
  db.query(`insert into transactions (household_id, member_id, date, amount_agorot, kind, merchant, source)
            values ($1, $2, '2026-11-05', 5000, 'expense', 'שופרסל', 'manual')`, [hid, member]);

test('non-allowlisted user cannot create a household', async () => {
  await asUser(db, C.id, C.email);
  await expect(db.query(`select create_household('x', 'y')`)).rejects.toThrow(/not_allowlisted/);
});

test('allowlist matching ignores email case', async () => {
  await asUser(db, A.id, 'A@X.com');
  await expect(db.query(`select create_household('x', 'y')`)).resolves.toBeTruthy();
});

test('create_household seeds categories and the general fund', async () => {
  await create(A);
  expect((await db.query(`select count(*)::int n from categories`)).rows[0]).toEqual({ n: 9 });
  expect((await db.query(`select name, is_general from funds`)).rows).toEqual([{ name: 'חיסכון כללי', is_general: true }]);
  expect((await db.query(`select role from members`)).rows).toEqual([{ role: 'owner' }]);
});

test('a second create_household fails', async () => {
  await create(A);
  await expect(db.query(`select create_household('x', 'y')`)).rejects.toThrow(/already_member/);
});

test('households are isolated from each other', async () => {
  const ha = await create(A);
  await addTxn(ha, A.id);
  await create(B);
  expect((await db.query(`select * from transactions`)).rows).toHaveLength(0);
  expect((await db.query(`select * from households`)).rows).toHaveLength(1);
  await expect(addTxn(ha, B.id)).rejects.toThrow(/row-level security/);
});

test('users cannot read the allowlist or invites directly', async () => {
  await create(A);
  await expect(db.query(`select * from allowlist`)).rejects.toThrow(/permission denied/);
  await expect(db.query(`select * from invites`)).rejects.toThrow(/permission denied/);
});

test('invite flow lets the invitee join and read', async () => {
  const ha = await create(A);
  await addTxn(ha, A.id);
  const token = (await db.query<{ t: string }>(`select create_invite('C@x.com') t`)).rows[0].t;
  await asUser(db, C.id, C.email);
  expect((await db.query<{ h: string }>(`select accept_invite($1, 'ג') h`, [token])).rows[0].h).toBe(ha);
  expect((await db.query(`select * from transactions`)).rows).toHaveLength(1);
});

test('an invite for another email is rejected', async () => {
  await create(A);
  const token = (await db.query<{ t: string }>(`select create_invite('c@x.com') t`)).rows[0].t;
  await asUser(db, B.id, B.email);
  await expect(db.query(`select accept_invite($1, 'ב')`, [token])).rejects.toThrow(/invite_invalid/);
});

test('only the owner deletes the household', async () => {
  const ha = await create(A);
  const token = (await db.query<{ t: string }>(`select create_invite('c@x.com') t`)).rows[0].t;
  await asUser(db, C.id, C.email);
  await db.query(`select accept_invite($1, 'ג')`, [token]);
  expect((await db.query(`delete from households where id = $1`, [ha])).affectedRows).toBe(0);
  await asUser(db, A.id, A.email);
  expect((await db.query(`delete from households where id = $1`, [ha])).affectedRows).toBe(1);
  await asAdmin(db);
  expect((await db.query(`select count(*)::int n from transactions`)).rows[0]).toEqual({ n: 0 });
});
