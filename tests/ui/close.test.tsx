import { render, screen } from '@testing-library/react';
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
