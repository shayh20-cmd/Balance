import { matchRows } from '../../src/engine/match';
import type { ImportedRow } from '../../src/import/types';
import { txn } from '../fixtures/engine';

let n = 0;
const row = (p: Partial<ImportedRow> & Pick<ImportedRow, 'date' | 'amount'>): ImportedRow => ({
  merchant: 'm', cardLast4: '1111', categoryHint: null, installment: null, pending: false,
  importKey: `k${++n}`, ...p,
});

test('matches a Google Pay txn to its file row by amount, date and card even when the names differ', () => {
  const t = txn({ date: '2026-11-17', amount: 4164, merchant: 'GINGIN MARKET', cardLast4: '1111', source: 'google_wallet' });
  const r = row({ date: '2026-11-17', amount: 4164, merchant: "ג'ינג'ז מרקט קרליבך" });
  expect(matchRows([t], [r])).toEqual({ matched: [{ txnId: t.id, row: r }], unmatched: [], ambiguous: [] });
});

test('matches across one day', () => {
  const t = txn({ date: '2026-11-17', amount: 4164, cardLast4: '1111' });
  const r = row({ date: '2026-11-16', amount: 4164 });
  expect(matchRows([t], [r]).matched).toHaveLength(1);
});

test('does not match two days apart', () => {
  const t = txn({ date: '2026-11-18', amount: 4164, cardLast4: '1111' });
  const r = row({ date: '2026-11-16', amount: 4164 });
  expect(matchRows([t], [r])).toEqual({ matched: [], unmatched: [r], ambiguous: [] });
});

test('two identical file rows and one captured txn: one matched, one unmatched', () => {
  const t = txn({ date: '2026-11-02', amount: 1200, cardLast4: '1111' });
  const a = row({ date: '2026-11-02', amount: 1200, merchant: 'EXPRESS 7', importKey: 'e#1' });
  const b = row({ date: '2026-11-02', amount: 1200, merchant: 'EXPRESS 7', importKey: 'e#2' });
  const res = matchRows([t], [a, b]);
  expect(res.matched).toEqual([{ txnId: t.id, row: a }]);
  expect(res.unmatched).toEqual([b]);
  expect(res.ambiguous).toEqual([]);
});

test('two identical file rows and two captured txns: both matched', () => {
  const t1 = txn({ date: '2026-11-02', amount: 1200, cardLast4: '1111' });
  const t2 = txn({ date: '2026-11-02', amount: 1200, cardLast4: '1111' });
  const a = row({ date: '2026-11-02', amount: 1200, importKey: 'e#1' });
  const b = row({ date: '2026-11-02', amount: 1200, importKey: 'e#2' });
  const res = matchRows([t1, t2], [a, b]);
  expect(res.matched.map((m) => m.txnId).sort()).toEqual([t1.id, t2.id].sort());
  expect(res.unmatched).toEqual([]);
});

test('two captured txns that both fit one row: the row is ambiguous', () => {
  const t1 = txn({ date: '2026-11-02', amount: 1200, cardLast4: '1111' });
  const t2 = txn({ date: '2026-11-02', amount: 1200, cardLast4: null });
  const r = row({ date: '2026-11-02', amount: 1200 });
  expect(matchRows([t1, t2], [r])).toEqual({ matched: [], unmatched: [], ambiguous: [r] });
});

test('an exact-date candidate wins over one a day off', () => {
  const t1 = txn({ date: '2026-11-02', amount: 1200 });
  const t2 = txn({ date: '2026-11-03', amount: 1200 });
  const r = row({ date: '2026-11-02', amount: 1200 });
  expect(matchRows([t1, t2], [r]).matched).toEqual([{ txnId: t1.id, row: r }]);
});

test('already-imported keys are skipped', () => {
  const t = txn({ date: '2026-11-02', amount: 1200, importKey: 'e#1', source: 'file' });
  const r = row({ date: '2026-11-02', amount: 1200, importKey: 'e#1' });
  expect(matchRows([t], [r])).toEqual({ matched: [], unmatched: [], ambiguous: [] });
});

test('a different card never matches', () => {
  const t = txn({ date: '2026-11-02', amount: 1200, cardLast4: '2222' });
  const r = row({ date: '2026-11-02', amount: 1200 });
  expect(matchRows([t], [r]).unmatched).toEqual([r]);
});

test('income and already-imported txns are not candidates', () => {
  const inc = txn({ date: '2026-11-02', amount: 1200, kind: 'income' });
  const imported = txn({ date: '2026-11-02', amount: 1200, importKey: 'other' });
  const r = row({ date: '2026-11-02', amount: 1200 });
  expect(matchRows([inc, imported], [r]).unmatched).toEqual([r]);
});
