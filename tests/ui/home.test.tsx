import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { MonthSummary } from '../../src/engine/month';
import type { WeekStatus } from '../../src/engine/week';
import ProgressBar from '../../src/ui/components/ProgressBar';
import { HomeView } from '../../src/ui/screens/Home';
import { txn } from '../fixtures/engine';

const summary: MonthSummary = {
  month: '2026-11', income: 2150000, fixed: 1090000, fundProvision: 240000, fundOverspend: 0,
  variableBudget: 820000, variableSpent: 136000, leftToSpend: 684000,
};
const week: WeekStatus = {
  week: { start: '2026-11-01', end: '2026-11-07', days: 7, index: 1 }, weekCount: 5,
  target: 164000, spent: 102000, remaining: 62000, projectedOverspend: 0,
};

function renderHome(p: Partial<Parameters<typeof HomeView>[0]> = {}) {
  return render(
    <MemoryRouter>
      <HomeView summary={summary} week={week} recent={[]} bank={null} householdName="בית כהן" memberCount={2} {...p} />
    </MemoryRouter>,
  );
}

test('shows left-to-spend formatted, with the month and household', () => {
  renderHome();
  expect(screen.getByText('6,840 ₪')).toBeInTheDocument();
  expect(screen.getByText('מתוך 8,200 ₪ להוצאות משתנות')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'נובמבר 2026' })).toBeInTheDocument();
  expect(screen.getByText('בית כהן · 2 משתתפים')).toBeInTheDocument();
});

test('week line shows spent and remaining', () => {
  renderHome();
  expect(screen.getByText('השבוע (1 מתוך 5)')).toBeInTheDocument();
  expect(screen.getByText('הוצאתם')).toBeInTheDocument();
  expect(screen.getByText('1,020 ₪')).toBeInTheDocument();
  expect(screen.getByText('נשארו 620 ₪ עד שבת')).toBeInTheDocument();
});

test('pace warning only when projectedOverspend > 0', () => {
  const { unmount } = renderHome();
  expect(screen.queryByText(/בקצב הנוכחי/)).toBeNull();
  unmount();
  renderHome({ week: { ...week, projectedOverspend: 15000 } });
  expect(screen.getByText('בקצב הנוכחי תחרגו בכ-150 ₪')).toBeInTheDocument();
});

test('recent transactions show merchant, amount and source pill', () => {
  renderHome({ recent: [txn({ date: '2026-11-03', amount: 34200, merchant: 'שופרסל', source: 'apple_pay' })] });
  expect(screen.getByText('שופרסל')).toBeInTheDocument();
  expect(screen.getByText('342 ₪')).toBeInTheDocument();
  expect(screen.getByText('Apple Pay')).toBeInTheDocument();
});

test('empty month renders 0 ₪ and no recent rows', () => {
  const zero = { ...summary, income: 0, fixed: 0, fundProvision: 0, variableBudget: 0, variableSpent: 0, leftToSpend: 0 };
  renderHome({ summary: zero, week: { ...week, target: 0, spent: 0, remaining: 0 } });
  expect(screen.getAllByText('0 ₪').length).toBeGreaterThan(0);
  expect(screen.getByText('אין עדיין עסקאות החודש')).toBeInTheDocument();
});

test('negative left-to-spend is shown as negative', () => {
  renderHome({ summary: { ...summary, leftToSpend: -32000 } });
  expect(screen.getByText('-320 ₪')).toHaveClass('negative');
});

test('bank balance missing shows "לא הוזנה", present shows amount and date', () => {
  const { unmount } = renderHome();
  expect(screen.getByText('יתרה בבנק')).toBeInTheDocument();
  expect(screen.getByText('לא הוזנה')).toBeInTheDocument();
  unmount();
  renderHome({ bank: { amount: 1421000, asOf: '2026-11-02' } });
  expect(screen.getByText('14,210 ₪')).toBeInTheDocument();
  expect(screen.getByText('עודכן 2.11.2026')).toBeInTheDocument();
});

test('review count card shows only when there is something to review', () => {
  const { unmount } = renderHome();
  expect(screen.queryByText('לבדיקה')).toBeNull();
  unmount();
  renderHome({ toReview: 3 });
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /לבדיקה/ })[0]).toHaveAttribute('href', '/review');
});

test('recent row shows the merchant initial and the date', () => {
  renderHome({ recent: [txn({ date: '2026-11-03', amount: 34200, merchant: 'שופרסל', source: 'manual' })] });
  expect(screen.getByText('ש')).toBeInTheDocument();
  expect(screen.getByText('3.11.2026')).toBeInTheDocument();
});

test('ProgressBar clamps its ratio to [0, 1]', () => {
  const { container, rerender } = render(<ProgressBar value={-5000} max={100000} />);
  expect((container.querySelector('i') as HTMLElement).style.width).toBe('0%');
  rerender(<ProgressBar value={200000} max={100000} />);
  expect((container.querySelector('i') as HTMLElement).style.width).toBe('100%');
  rerender(<ProgressBar value={5} max={0} />);
  expect((container.querySelector('i') as HTMLElement).style.width).toBe('100%');
});

const b = {
  income: [], fixed: [], variable: [], received: 1500000, paidFixed: 600000,
};

test('arrows move between months', async () => {
  const onPrev = vi.fn();
  const onNext = vi.fn();
  renderHome({ onPrev, onNext });
  await userEvent.click(screen.getByRole('button', { name: 'החודש הקודם' }));
  await userEvent.click(screen.getByRole('button', { name: 'החודש הבא' }));
  expect(onPrev).toHaveBeenCalledTimes(1);
  expect(onNext).toHaveBeenCalledTimes(1);
});

test('income card shows the month total and links to the income detail', () => {
  renderHome({ breakdown: b });
  const income = screen.getByRole('link', { name: /הכנסות/ });
  expect(income).toHaveAttribute('href', '/month/2026-11/income');
  expect(income).toHaveTextContent('21,500 ₪');
  expect(income).toHaveTextContent('התקבלו 15,000 ₪');
});

test('expenses card shows the total and links to fixed and variable', () => {
  renderHome({ breakdown: b });
  expect(screen.getByText('הוצאות החודש')).toBeInTheDocument();
  expect(screen.getByText('12,260 ₪')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /קבועות/ })).toHaveAttribute('href', '/month/2026-11/fixed');
  expect(screen.getByRole('link', { name: /משתנות/ })).toHaveAttribute('href', '/month/2026-11/variable');
  expect(screen.getByRole('link', { name: /קבועות/ })).toHaveTextContent('שולמו 6,000 ₪');
});

test('another month hides the week and says what the number means', () => {
  renderHome({ week: null, current: 'past' });
  expect(screen.queryByText(/השבוע/)).toBeNull();
  expect(screen.getByText('נשאר בסוף החודש')).toBeInTheDocument();
  renderHome({ week: null, current: 'future' });
  expect(screen.getByText('צפוי להוצאות משתנות')).toBeInTheDocument();
});
