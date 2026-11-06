import { splitInstallments } from '../../src/engine/installments';

test('remainder goes to the first installment; dates clamp to month end', () => {
  expect(splitInstallments(100000, 3, '2026-01-31')).toEqual([
    { date: '2026-01-31', amount: 33334, index: 1 },
    { date: '2026-02-28', amount: 33333, index: 2 },
    { date: '2026-03-31', amount: 33333, index: 3 },
  ]);
});
test('a single installment is the whole amount', () => {
  expect(splitInstallments(5000, 1, '2026-11-05')).toEqual([{ date: '2026-11-05', amount: 5000, index: 1 }]);
});
