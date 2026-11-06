import { computeMonth, isDueInMonth } from '../../src/engine/month';
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
