import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CloseReminder, { reminderMonth } from '../../src/ui/components/CloseReminder';
import { summaryLine } from '../../src/ui/screens/CloseMonth';

const renderReminder = (today: string, closed: string[]) =>
  render(
    <MemoryRouter>
      <CloseReminder today={today} closed={closed} />
    </MemoryRouter>,
  );

test('reminder shows on the 3rd when last month is open', () => {
  renderReminder('2026-12-03', []);
  expect(screen.getByText('סגירת חודש נובמבר: העלו את הדוחות מלאומי')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'לסגירת החודש' })).toHaveAttribute('href', '/close/2026-11');
});

test('reminder hidden on the 2nd', () => {
  renderReminder('2026-12-02', []);
  expect(screen.queryByText(/סגירת חודש/)).toBeNull();
});

test('reminder hidden when last month is closed', () => {
  renderReminder('2026-12-15', ['2026-11']);
  expect(screen.queryByText(/סגירת חודש/)).toBeNull();
});

test('reminder month wraps across the year', () => {
  expect(reminderMonth('2027-01-05', [])).toBe('2026-12');
});

test('a summary line reads "1111: התאמנו 1, נוספו 6, 0 לבדיקה"', () => {
  expect(summaryLine('1111', { matched: 1, added: 6, review: 0, skipped: 0 })).toBe('1111: התאמנו 1, נוספו 6, 0 לבדיקה');
});

test('a failed installment step warns and keeps importing', async () => {
  const { addInstallmentItems } = await import('../../src/ui/screens/CloseMonth');
  const file = { cardLast4: '1111', billingMonth: '2026-12', chargedTotal: 0, rows: [{
    date: '2026-11-22', amount: 12200, merchant: 'ליברה', cardLast4: '1111', categoryHint: null, pending: false,
    installment: { index: 6, count: 10, purchaseDate: '2026-06-22', total: 122000 }, importKey: 'k#1',
  }] };
  const failing = await addInstallmentItems(file, [], async () => { throw new Error('column does not exist'); }, async () => []);
  expect(failing).toEqual({ items: [], line: 'לא הצלחנו להוסיף את העסקאות בתשלומים לקבועות' });
  const ok = await addInstallmentItems(file, [], async () => 1, async () => []);
  expect(ok.line).toBe('נוספו 1 עסקאות בתשלומים לקבועות');
});

test('a closed month says so and can be reopened', async () => {
  const { ClosedNotice } = await import('../../src/ui/screens/CloseMonth');
  const { default: userEvent } = await import('@testing-library/user-event');
  const onReopen = vi.fn();
  render(<ClosedNotice month="2026-11" onReopen={onReopen} />);
  expect(screen.getByText(/החודש נובמבר סגור/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'פתיחת החודש מחדש' }));
  expect(onReopen).toHaveBeenCalled();
});

test('imports are summarized per month by card and checking', async () => {
  const { summarizeImports } = await import('../../src/data/importRepo');
  expect(summarizeImports([
    { date: '2026-11-02', card_last4: '5218', import_key: 'card:5218:a' },
    { date: '2026-11-03', card_last4: '5218', import_key: 'card:5218:b' },
    { date: '2026-11-03', card_last4: null, import_key: 'bank:2026-11-03:x' },
    { date: '2026-10-20', card_last4: '7712', import_key: 'card:7712:c' },
  ])).toEqual({
    '2026-11': [{ label: '5218', count: 2 }, { label: 'עו"ש', count: 1 }],
    '2026-10': [{ label: '7712', count: 1 }],
  });
});

test('the months screen lists each month with its status and files', async () => {
  const { MonthsList } = await import('../../src/ui/screens/CloseMonths');
  render(
    <MemoryRouter>
      <MonthsList months={['2026-11', '2026-10']} closed={['2026-10']} imports={{ '2026-10': [{ label: '7712', count: 82 }] }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: /נובמבר 2026/ })).toHaveAttribute('href', '/close/2026-11');
  expect(screen.getByText(/פתוח · עוד לא נטענו קבצים/)).toBeInTheDocument();
  expect(screen.getByText(/סגור · כרטיס 7712: 82/)).toBeInTheDocument();
});
