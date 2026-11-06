import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import FundCard from '../../src/ui/components/FundCard';
import { fund } from '../fixtures/engine';

test('fund card shows the monthly provision from fundProvision', () => {
  const trip = { ...fund({ id: 'trip', name: 'טיול אוגוסט', target: 1200000, targetDate: '2027-08-15' }), annual: false };
  render(<FundCard fund={trip} month="2026-11" onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.getByText('טיול אוגוסט')).toBeInTheDocument();
  expect(screen.getByText('הפרשה החודש: 1,333.34 ₪')).toBeInTheDocument();
  expect(screen.getByText('0 ₪ / 12,000 ₪')).toBeInTheDocument();
  expect(screen.getByText('עד 15.8.2027')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'מחיקה' })).toBeInTheDocument();
});

test('the general fund has no delete button and no target', () => {
  const general = { ...fund({ id: 'g', name: 'חיסכון כללי', target: 0, targetDate: '2099-12-31', isGeneral: true, balance: 50000 }), annual: false };
  render(<FundCard fund={general} month="2026-11" onEdit={vi.fn()} onDelete={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'מחיקה' })).toBeNull();
  expect(screen.getByText('500 ₪')).toBeInTheDocument();
  expect(screen.queryByText(/הפרשה החודש/)).toBeNull();
});
