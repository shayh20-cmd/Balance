import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', 'supabase');

export async function newDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests', 'auth-stub.sql'), 'utf8'));
  const dir = join(root, 'migrations');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return db;
}

export async function asUser(db: PGlite, id: string, email: string): Promise<void> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: id, email })]);
  await db.exec('set role authenticated');
}

export async function asAdmin(db: PGlite): Promise<void> {
  await db.exec('reset role');
}
