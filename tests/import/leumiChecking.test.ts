// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkRecurring, parseLeumiChecking, type CheckingFile, type CheckingRow } from '../../src/import/leumiChecking';
import { readWorkbook } from '../../src/import/sheets';
import { item } from '../fixtures/engine';

let file: CheckingFile;
beforeAll(async () => {
  const b = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'leumi-checking.xlsx'));
  file = parseLeumiChecking(await readWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
});

const by = (d: string) => file.rows.find((r) => r.description === d)!;

const items = [
  item({ id: 'salary', kind: 'income', amount: 2070000, dayOfMonth: 2 }),
  item({ id: 'rentIn', kind: 'income', amount: 290000, dayOfMonth: 1 }),
  item({ id: 'rent', kind: 'fixed', amount: 840000, dayOfMonth: 3 }),
  item({ id: 'gan', kind: 'fixed', amount: 585000, dayOfMonth: 1 }),
  item({ id: 'vaad', kind: 'fixed', amount: 102600, dayOfMonth: 10 }),
];

test('parses credits, debits and the latest balance', () => {
  expect(file.rows).toHaveLength(7);
  expect(by('משכורת-חברה בע"מ')).toMatchObject({ date: '2026-11-02', amount: 2230400, kind: 'income' });
  expect(by('שיק')).toMatchObject({ date: '2026-11-02', amount: 840000, kind: 'expense' });
  expect(by('עמלת פעולה')).toMatchObject({ amount: 1000, kind: 'expense' });
  expect(file.balance).toEqual({ amount: 1400000, asOf: '2026-11-10' });
  expect(by('שיק').importKey).toBe('bank:2026-11-02:expense:840000:שיק#1');
});

test('card settlement rows are flagged', () => {
  expect(by('לאומי מאסטרקרד').isCardSettlement).toBe(true);
  expect(by('שיק').isCardSettlement).toBe(false);
  const rows = parseLeumiChecking([{ name: 's', rows: [
    ['תאריך', 'תיאור', 'זכות', 'חובה', 'יתרה מצטברת'],
    ['05/11/2026', 'לאומי ויזה', null, 100, 0],
    ['05/11/2026', 'מיכאל כהן', null, 100, 0],
    ['05/11/2026', 'MAX IT', null, 100, 0],
  ] }]).rows;
  expect(rows.map((r) => r.isCardSettlement)).toEqual([true, false, true]);
});

test('salary 22,304 links to the 20,700 salary item; rent cheque 8,400 links to rent', () => {
  const links = linkRecurring(file.rows, items, '2026-11');
  expect(links.every((l) => !l.uncertain)).toBe(true);
  const linked = Object.fromEntries(links.map((l) => [l.itemId, file.rows.find((r) => r.importKey === l.rowKey)!.description]));
  expect(linked).toEqual({
    salary: 'משכורת-חברה בע"מ', rentIn: 'בנק הפועלים', rent: 'שיק', gan: 'הגנינה בע"מ-י', vaad: 'ועד הבית',
  });
});

const row = (p: Partial<CheckingRow> & Pick<CheckingRow, 'amount' | 'importKey'>): CheckingRow => ({
  date: '2026-11-02', description: 'x', kind: 'income', isCardSettlement: false, ...p,
});

test('a row 30% off the expected amount links only as uncertain', () => {
  expect(linkRecurring([row({ amount: 2691000, importKey: 'a' })], [items[0]], '2026-11')).toEqual([{ rowKey: 'a', itemId: 'salary', uncertain: true }]);
});

test('a row 60% off the expected amount does not link', () => {
  expect(linkRecurring([row({ amount: 3312000, importKey: 'a' })], [items[0]], '2026-11')).toEqual([]);
});

test('a row 10 days from the due day links only as uncertain; 13 days does not link', () => {
  expect(linkRecurring([row({ amount: 2070000, importKey: 'a', date: '2026-11-12' })], [items[0]], '2026-11')).toEqual([{ rowKey: 'a', itemId: 'salary', uncertain: true }]);
  expect(linkRecurring([row({ amount: 2070000, importKey: 'a', date: '2026-11-15' })], [items[0]], '2026-11')).toEqual([]);
});

test('each row links to at most one item', () => {
  const two = [item({ id: 'a', kind: 'income', amount: 100000, dayOfMonth: 2 }), item({ id: 'b', kind: 'income', amount: 100000, dayOfMonth: 2 })];
  expect(linkRecurring([row({ amount: 100000, importKey: 'r' })], two, '2026-11')).toHaveLength(1);
});

test('items not due this month and card settlements are left alone', () => {
  const bimonthly = item({ id: 'water', kind: 'fixed', amount: 23900, dayOfMonth: 2, intervalMonths: 2, startMonth: '2026-10' });
  expect(linkRecurring([row({ amount: 23900, kind: 'expense', importKey: 'w' })], [bimonthly], '2026-11')).toEqual([]);
  const card = item({ id: 'c', kind: 'fixed', amount: 100000, dayOfMonth: 2 });
  expect(linkRecurring([row({ amount: 100000, kind: 'expense', importKey: 's', isCardSettlement: true })], [card], '2026-11')).toEqual([]);
});

test('a variable item links a bill 40% above expected without review', () => {
  const water = item({ id: 'water', kind: 'fixed', amount: 23900, dayOfMonth: 24, variableAmount: true });
  const bill = row({ amount: 33460, kind: 'expense', importKey: 'w', date: '2026-11-24' });
  expect(linkRecurring([bill], [water], '2026-11')).toEqual([{ rowKey: 'w', itemId: 'water', uncertain: false }]);
});

describe('card items', () => {
  const cardRow = (merchant: string, amount: number, date = '2026-11-03', importKey = merchant) =>
    ({ date, amount, kind: 'expense' as const, isCardSettlement: false, importKey, merchant });
  const netflixKnown = item({ id: 'nf', kind: 'fixed', amount: 5490, dayOfMonth: 3, paidBy: 'card', merchantKey: 'netflixcom amsterdam nld' });
  const netflixNew = item({ id: 'nf', kind: 'fixed', amount: 5490, dayOfMonth: 3, paidBy: 'card' });

  test('a card item links surely only to its own merchant', () => {
    expect(linkRecurring([cardRow('NETFLIX.COM AMSTERDAM NLD', 5490)], [netflixKnown], '2026-11')).toEqual([{ rowKey: 'NETFLIX.COM AMSTERDAM NLD', itemId: 'nf', uncertain: false }]);
  });

  test('another merchant with the same amount and day never links to a card item with a known merchant', () => {
    expect(linkRecurring([cardRow('שומשום קונקורד', 5490)], [netflixKnown], '2026-11')).toEqual([]);
  });

  test('a card item whose merchant is not known yet links only for review', () => {
    expect(linkRecurring([cardRow('NETFLIX.COM AMSTERDAM NLD', 5490)], [netflixNew], '2026-11')).toEqual([{ rowKey: 'NETFLIX.COM AMSTERDAM NLD', itemId: 'nf', uncertain: true }]);
    expect(linkRecurring([cardRow('BIKOL', 7000)], [netflixNew], '2026-11')).toEqual([]);
  });

  test('a known merchant links even when the price changed', () => {
    expect(linkRecurring([cardRow('NETFLIX.COM AMSTERDAM NLD', 6990, '2026-11-05')], [netflixKnown], '2026-11')[0]).toMatchObject({ itemId: 'nf', uncertain: false });
  });
});
