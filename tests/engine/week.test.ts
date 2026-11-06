import { computeWeek, weeksOfMonth } from '../../src/engine/week';
import { item, txn } from '../fixtures/engine';

const input = (txns = [] as ReturnType<typeof txn>[]) => ({
  month: '2026-11',
  recurring: [item({ id: 'inc', kind: 'income', amount: 820000 })],
  funds: [],
  txns,
  carryIn: 0,
});

test('weeksOfMonth: Sunday to Saturday, clipped to the month', () => {
  expect(weeksOfMonth('2026-11').map((w) => [w.start, w.end, w.days])).toEqual([
    ['2026-11-01', '2026-11-07', 7], ['2026-11-08', '2026-11-14', 7], ['2026-11-15', '2026-11-21', 7],
    ['2026-11-22', '2026-11-28', 7], ['2026-11-29', '2026-11-30', 2],
  ]);
  expect(weeksOfMonth('2026-12')[0]).toMatchObject({ start: '2026-12-01', end: '2026-12-05', days: 5, index: 1 });
});

test('week 1 target with no spending', () => {
  const w = computeWeek(input(), '2026-11-03');
  expect(w.week.index).toBe(1);
  expect(w.weekCount).toBe(5);
  expect(w.target).toBe(191333);
  expect(w.remaining).toBe(191333);
});

test('overspending in week 1 lowers the week 2 target', () => {
  const w = computeWeek(input([txn({ date: '2026-11-04', amount: 300000 })]), '2026-11-09');
  expect(w.target).toBe(158260);
  expect(w.spent).toBe(0);
});

test('pace warning projects overspend', () => {
  const w = computeWeek(input([txn({ date: '2026-11-02', amount: 102000 })]), '2026-11-03');
  expect(w.projectedOverspend).toBe(46667);
});

test('last partial week divides by its own two days', () => {
  const w = computeWeek(input(), '2026-11-30');
  expect(w.week.index).toBe(5);
  expect(w.target).toBe(820000);
});

test('refund-only week raises remaining and has no overspend', () => {
  const w = computeWeek(input([txn({ date: '2026-11-02', amount: -5000 })]), '2026-11-03');
  expect(w.spent).toBe(-5000);
  expect(w.remaining).toBe(w.target + 5000);
  expect(w.projectedOverspend).toBe(0);
});

test('target never goes below zero when the month is overspent', () => {
  const w = computeWeek(input([txn({ date: '2026-11-02', amount: 900000 })]), '2026-11-10');
  expect(w.target).toBe(0);
});

test('today outside the month throws', () => {
  expect(() => computeWeek(input(), '2026-12-01')).toThrow();
});
