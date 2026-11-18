import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import RecurringLine, { endMonthError } from '../../src/ui/components/RecurringLine';
import { item } from '../fixtures/engine';

test('a variable item shows its expected average', () => {
  const water = item({ id: 'w', name: 'מים', kind: 'fixed', amount: 23900, intervalMonths: 2, variableAmount: true });
  render(<RecurringLine item={water} expected={25333} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText('מים')).toBeInTheDocument();
  expect(screen.getByText(/משתנה · צפוי 253.33 ₪/)).toBeInTheDocument();
  expect(screen.getByText('253.33 ₪')).toBeInTheDocument();
});

test('an item with an end month shows "עד דצמבר 2026"', () => {
  const loan = item({ id: 'l', name: 'הלוואה', kind: 'fixed', amount: 100000, endMonth: '2026-12' });
  render(<RecurringLine item={loan} expected={100000} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText(/עד דצמבר 2026/)).toBeInTheDocument();
  expect(screen.queryByText(/משתנה/)).toBeNull();
});

test('an installment item says it came from the card file', () => {
  const inst = item({ id: 'i', name: 'ליברה (תשלומים)', kind: 'fixed', amount: 12200, paidBy: 'card', installmentKey: 'inst:x', endMonth: '2027-03' });
  render(<RecurringLine item={inst} expected={12200} onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText(/נוצר מקובץ האשראי/)).toBeInTheDocument();
});

test('an end month before the start is rejected', () => {
  expect(endMonthError('2026-11', '2026-10')).toBe('החודש האחרון לפני חודש ההתחלה');
  expect(endMonthError('2026-11', '2026-11')).toBeNull();
  expect(endMonthError('2026-11', '')).toBeNull();
});
