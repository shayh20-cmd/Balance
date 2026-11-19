import { iconFor } from '../../src/ui/components/TxIcon';
import { txn } from '../fixtures/engine';

test('each default category has its icon; income and fixed items have theirs; anything else gets dots', () => {
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'סופר')).toBe('cart');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'אוכל בחוץ')).toBe('utensils');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'דלק ותחבורה')).toBe('car');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'בריאות')).toBe('heart');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'ילדים')).toBe('baby');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'פנאי')).toBe('ticket');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'קניות')).toBe('bag');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'בית')).toBe('home');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1 }), 'קטגוריה שלי')).toBe('dots');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1, kind: 'income' }), null)).toBe('income');
  expect(iconFor(txn({ date: '2026-11-01', amount: 1, recurringItemId: 'r' }), 'בית')).toBe('repeat');
});
