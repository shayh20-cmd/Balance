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
  expect(matchRows([t], [r])).toEqual({ matched: [{ txnId: t.id, row: r, uncertain: false }], unmatched: [] });
});

test('matches across one day', () => {
  const t = txn({ date: '2026-11-17', amount: 4164, cardLast4: '1111' });
  const r = row({ date: '2026-11-16', amount: 4164 });
  expect(matchRows([t], [r]).matched).toHaveLength(1);
});

test('does not match two days apart', () => {
  const t = txn({ date: '2026-11-18', amount: 4164, cardLast4: '1111' });
  const r = row({ date: '2026-11-16', amount: 4164 });
  expect(matchRows([t], [r])).toEqual({ matched: [], unmatched: [r] });
});

test('two identical file rows and one captured txn: one matched, one unmatched', () => {
  const t = txn({ date: '2026-11-02', amount: 1200, cardLast4: '1111' });
  const a = row({ date: '2026-11-02', amount: 1200, merchant: 'EXPRESS 7', importKey: 'e#1' });
  const b = row({ date: '2026-11-02', amount: 1200, merchant: 'EXPRESS 7', importKey: 'e#2' });
  const res = matchRows([t], [a, b]);
  expect(res.matched).toEqual([{ txnId: t.id, row: a, uncertain: false }]);
  expect(res.unmatched).toEqual([b]);
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

test('two captured txns that both fit one row: merged with one, flagged uncertain, nothing inserted', () => {
  const t1 = txn({ date: '2026-11-02', amount: 1200, cardLast4: '1111' });
  const t2 = txn({ date: '2026-11-02', amount: 1200, cardLast4: null });
  const r = row({ date: '2026-11-02', amount: 1200 });
  const res = matchRows([t1, t2], [r]);
  expect(res.unmatched).toEqual([]);
  expect(res.matched).toEqual([{ txnId: t1.id, row: r, uncertain: true }]);
});

test('two same-amount purchases at two shops, both captured: both merged, none inserted', () => {
  const t1 = txn({ date: '2026-11-02', amount: 1200 });
  const t2 = txn({ date: '2026-11-02', amount: 1200 });
  const a = row({ date: '2026-11-02', amount: 1200, merchant: 'A', importKey: 'a#1' });
  const b = row({ date: '2026-11-02', amount: 1200, merchant: 'B', importKey: 'b#1' });
  const res = matchRows([t1, t2], [a, b]);
  expect(res.unmatched).toEqual([]);
  expect(res.matched.map((m) => m.txnId).sort()).toEqual([t1.id, t2.id].sort());
});

test('a pending file row matches its later charged row even when the key changed', () => {
  const p = txn({ date: '2026-11-17', amount: 4164, importKey: 'card:1111:2026-11-17:4164:old:0#1', source: 'file', status: 'pending', cardLast4: '1111' });
  const r = row({ date: '2026-11-18', amount: 4164, importKey: 'card:1111:2026-11-18:4164:new:0#1' });
  expect(matchRows([p], [r]).matched).toEqual([{ txnId: p.id, row: r, uncertain: false }]);
});

test('a pending file row whose key is still in the file is not a candidate', () => {
  const p = txn({ date: '2026-11-17', amount: 4164, importKey: 'still', source: 'file', status: 'pending' });
  const same = row({ date: '2026-11-17', amount: 4164, importKey: 'still' });
  const other = row({ date: '2026-11-17', amount: 4164, importKey: 'other#1' });
  expect(matchRows([p], [same, other]).unmatched).toEqual([other]);
});

test('bank mode skips card transactions', () => {
  const gp = txn({ date: '2026-11-02', amount: 30000, cardLast4: '1111', source: 'google_wallet' });
  const manual = txn({ date: '2026-11-02', amount: 30000, merchant: 'ביט לדני' });
  const r = row({ date: '2026-11-02', amount: 30000, cardLast4: null });
  expect(matchRows([gp, manual], [r], { bank: true }).matched).toEqual([{ txnId: manual.id, row: r, uncertain: false }]);
});

test('an exact-date candidate wins over one a day off', () => {
  const t1 = txn({ date: '2026-11-02', amount: 1200 });
  const t2 = txn({ date: '2026-11-03', amount: 1200 });
  const r = row({ date: '2026-11-02', amount: 1200 });
  expect(matchRows([t1, t2], [r]).matched).toEqual([{ txnId: t1.id, row: r, uncertain: false }]);
});

test('already-imported keys are skipped', () => {
  const t = txn({ date: '2026-11-02', amount: 1200, importKey: 'e#1', source: 'file' });
  const r = row({ date: '2026-11-02', amount: 1200, importKey: 'e#1' });
  expect(matchRows([t], [r])).toEqual({ matched: [], unmatched: [] });
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
