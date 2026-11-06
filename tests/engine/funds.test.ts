import { fundOverspend, fundProvision } from '../../src/engine/funds';
import { fund, txn } from '../fixtures/engine';

const trip = fund({ id: 'trip', target: 1200000, targetDate: '2027-08-15' });

test('provision spreads the remaining target over the months left', () => {
  expect(fundProvision(trip, '2026-11')).toBe(133334);
  expect(fundProvision({ ...trip, balance: 400000 }, '2026-11')).toBe(88889);
});

test('a target this month provisions the whole remainder', () => {
  expect(fundProvision(fund({ id: 'test', target: 115000, targetDate: '2026-11-15', balance: 60000 }), '2026-11')).toBe(55000);
});

test('past targets, full funds and the general fund provision nothing', () => {
  expect(fundProvision(fund({ id: 'p', target: 100000, targetDate: '2026-10-01' }), '2026-11')).toBe(0);
  expect(fundProvision({ ...trip, balance: 1200000 }, '2026-11')).toBe(0);
  expect(fundProvision(fund({ id: 'g', target: 0, targetDate: '2099-12-31', isGeneral: true }), '2026-11')).toBe(0);
});

test('spending beyond what the fund holds is overspend', () => {
  const car = fund({ id: 'car', target: 120000, targetDate: '2026-12-01', balance: 100000 });
  expect(fundProvision(car, '2026-11')).toBe(20000);
  expect(fundOverspend(car, '2026-11', [txn({ date: '2026-11-15', amount: 150000, fundId: 'car' })])).toBe(30000);
  expect(fundOverspend(car, '2026-11', [txn({ date: '2026-11-15', amount: 90000, fundId: 'car' })])).toBe(0);
});
