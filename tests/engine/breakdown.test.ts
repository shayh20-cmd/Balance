import { breakdown } from '../../src/engine/breakdown';
import { computeMonth } from '../../src/engine/month';
import { item, txn } from '../fixtures/engine';

const salary = item({ id: 'salary', name: 'משכורת', kind: 'income', amount: 2070000, dayOfMonth: 2 });
const child = item({ id: 'child', name: 'קצבת ילדים', kind: 'income', amount: 27600, dayOfMonth: 20 });
const rent = item({ id: 'rent', name: 'שכר דירה', kind: 'fixed', amount: 840000, dayOfMonth: 3 });
const water = item({ id: 'water', name: 'מים', kind: 'fixed', amount: 23900, intervalMonths: 2, startMonth: '2026-09' });
const recurring = [salary, child, rent, water];
const txns = [
  txn({ date: '2026-11-02', amount: 2230400, kind: 'income', recurringItemId: 'salary' }),
  txn({ date: '2026-11-15', amount: 50000, kind: 'income', merchant: 'ביט מאמא' }),
  txn({ date: '2026-11-02', amount: 840000, recurringItemId: 'rent' }),
  txn({ date: '2026-11-05', amount: 30000, merchant: 'סופר' }),
  txn({ date: '2026-11-02', amount: 1212319, isCardSettlement: true }),
  txn({ date: '2026-10-30', amount: 9000, merchant: 'אוקטובר' }),
];
const input = { month: '2026-11', recurring, funds: [], txns, carryIn: 0 };

test('income lines: paid items show the actual, unpaid ones the expected, extra income on its own line', () => {
  const b = breakdown(input);
  expect(b.income.map((l) => [l.name, l.expected, l.actual])).toEqual([
    ['משכורת', 2070000, 2230400],
    ['קצבת ילדים', 27600, null],
    ['ביט מאמא', 0, 50000],
  ]);
  expect(b.received).toBe(2280400);
});

test('fixed lines count only items due this month or paid in it', () => {
  const b = breakdown(input);
  expect(b.fixed.map((l) => [l.name, l.expected, l.actual])).toEqual([
    ['שכר דירה', 840000, 840000],
    ['מים', 23900, null],
  ]);
  expect(b.paidFixed).toBe(840000);
  expect(breakdown({ ...input, month: '2026-12' }).fixed.map((l) => l.name)).toEqual(['שכר דירה']);
});

test('variable spending lists this month only, without settlements, and totals match computeMonth', () => {
  const b = breakdown(input);
  expect(b.variable.map((t) => t.merchant)).toEqual(['סופר']);
  const s = computeMonth(input);
  expect(b.income.reduce((a, l) => a + (l.actual ?? l.expected), 0)).toBe(s.income);
  expect(b.fixed.reduce((a, l) => a + (l.actual ?? l.expected), 0)).toBe(s.fixed);
});

test('a future month is all expected', () => {
  const b = breakdown({ ...input, month: '2027-01', txns: [] });
  expect(b.received).toBe(0);
  expect(b.income.every((l) => l.actual === null)).toBe(true);
});
