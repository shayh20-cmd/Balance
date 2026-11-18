import { computeMonth, expectedAmount, isDueInMonth } from '../../src/engine/month';
import { item, txn } from '../fixtures/engine';

const salary = item({ id: 'salary', kind: 'income', amount: 1500000 });
const rent = item({ id: 'rent', kind: 'fixed', amount: 600000 });
const arnona = item({ id: 'arnona', kind: 'fixed', amount: 80000, intervalMonths: 2, startMonth: '2026-02' });
const netflix = item({ id: 'netflix', kind: 'fixed', amount: 5990, paidBy: 'card' });
const recurring = [salary, rent, arnona, netflix];
const base = { month: '2026-11', recurring, funds: [], txns: [], carryIn: 0 };

test('empty input gives all zeros', () => {
  expect(computeMonth({ month: '2026-11', recurring: [], funds: [], txns: [], carryIn: 0 })).toEqual({
    month: '2026-11', income: 0, fixed: 0, fundProvision: 0, fundOverspend: 0,
    variableBudget: 0, variableSpent: 0, leftToSpend: 0,
  });
});

test('expected amounts when nothing is linked', () => {
  const s = computeMonth(base);
  expect(s.income).toBe(1500000);
  expect(s.fixed).toBe(605990);
  expect(s.variableBudget).toBe(894010);
});

test('isDueInMonth honours interval and start month', () => {
  expect(isDueInMonth(arnona, '2026-11')).toBe(false);
  expect(isDueInMonth(arnona, '2026-12')).toBe(true);
  expect(isDueInMonth(arnona, '2026-01')).toBe(false);
  expect(isDueInMonth({ ...rent, active: false }, '2026-11')).toBe(false);
});

test('actual linked income replaces the expected amount', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-11-10', amount: 1480000, kind: 'income', recurringItemId: 'salary' })] });
  expect(s.income).toBe(1480000);
});

test('unlinked income adds to income', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-11-12', amount: 30000, kind: 'income' })] });
  expect(s.income).toBe(1530000);
});

test('a card txn linked to a fixed item is not variable', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-11-03', amount: 5990, recurringItemId: 'netflix' })] });
  expect(s.variableSpent).toBe(0);
  expect(s.fixed).toBe(605990);
});

test('a refund reduces variable spending', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-11-02', amount: 34200 }), txn({ date: '2026-11-04', amount: -4200 })] });
  expect(s.variableSpent).toBe(30000);
});

test('card settlement lines are ignored', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-11-02', amount: 438000, isCardSettlement: true })] });
  expect(s.variableSpent).toBe(0);
});

test('transactions from another month are ignored', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-10-31', amount: 10000 })] });
  expect(s.variableSpent).toBe(0);
});

test('leftToSpend includes carryIn', () => {
  const s = computeMonth({ ...base, carryIn: -20000, txns: [txn({ date: '2026-11-05', amount: 100000 })] });
  expect(s.variableBudget).toBe(874010);
  expect(s.leftToSpend).toBe(774010);
});

import { fund } from '../fixtures/engine';
import { computeWeek } from '../../src/engine/week';

test('fund provision and overspend enter the month', () => {
  const car = fund({ id: 'car', target: 120000, targetDate: '2026-12-01', balance: 100000 });
  const trip = fund({ id: 'trip', target: 1200000, targetDate: '2027-08-15' });
  const s = computeMonth({ ...base, funds: [car, trip], txns: [txn({ date: '2026-11-15', amount: 150000, fundId: 'car' })] });
  expect(s.fundProvision).toBe(153334);
  expect(s.fundOverspend).toBe(30000);
  expect(s.variableBudget).toBe(894010 - 153334);
  expect(s.variableSpent).toBe(30000);
});

test('fund overspend lowers the weekly target', () => {
  const car = fund({ id: 'car', target: 0, targetDate: '2026-10-01', balance: 0 });
  const plain = computeWeek({ ...base, funds: [car] }, '2026-11-10');
  const over = computeWeek({ ...base, funds: [car], txns: [txn({ date: '2026-11-02', amount: 23000, fundId: 'car' })] }, '2026-11-10');
  expect(over.target).toBeLessThan(plain.target);
});

test('a payment linked to a fixed item outside its due month still counts as fixed', () => {
  const s = computeMonth({ ...base, txns: [txn({ date: '2026-11-20', amount: 80000, recurringItemId: 'arnona' })] });
  expect(s.fixed).toBe(605990 + 80000);
  expect(s.variableSpent).toBe(0);
});

test('income linked to an item outside its due month still counts as income', () => {
  const bonus = item({ id: 'bonus', kind: 'income', amount: 500000, intervalMonths: 12, startMonth: '2026-03' });
  const s = computeMonth({ ...base, recurring: [...recurring, bonus], txns: [txn({ date: '2026-11-20', amount: 450000, kind: 'income', recurringItemId: 'bonus' })] });
  expect(s.income).toBe(1500000 + 450000);
});

const loan = item({ id: 'loan', kind: 'fixed', amount: 100000, startMonth: '2026-01', endMonth: '2026-12' });

test('an item is not due after its end month', () => {
  expect(isDueInMonth(loan, '2026-12')).toBe(true);
  expect(isDueInMonth(loan, '2027-01')).toBe(false);
  expect(computeMonth({ ...base, month: '2027-01', recurring: [loan] }).fixed).toBe(0);
});

test('a linked payment after the end month still counts', () => {
  const late = txn({ date: '2027-01-05', amount: 100000, recurringItemId: 'loan' });
  expect(computeMonth({ ...base, month: '2027-01', recurring: [loan], txns: [late] }).fixed).toBe(100000);
});

const water = item({ id: 'water', kind: 'fixed', amount: 23900, variableAmount: true });

test('variable item expects the average of its last 3 months with actuals', () => {
  const h = { '2026-07': 20000, '2026-09': 26000, '2026-10': 30000, '2026-11': 99999 };
  expect(expectedAmount(water, h, '2026-11')).toBe(25333);
  expect(computeMonth({ ...base, recurring: [water], history: { water: h } }).fixed).toBe(25333);
});

test('variable item with no history expects the entered amount', () => {
  expect(expectedAmount(water, undefined, '2026-11')).toBe(23900);
  expect(expectedAmount(water, {}, '2026-11')).toBe(23900);
});

test('a month with two linked payments counts as their sum', () => {
  // history holds per-month sums: a catch-up month of 2 bills is one month of 40000
  expect(expectedAmount(water, { '2026-09': 40000, '2026-10': 20000 }, '2026-11')).toBe(30000);
});

test('non-variable item ignores history', () => {
  const fixedWater = { ...water, variableAmount: false };
  expect(expectedAmount(fixedWater, { '2026-10': 50000 }, '2026-11')).toBe(23900);
});
