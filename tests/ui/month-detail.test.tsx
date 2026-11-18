import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { breakdown } from '../../src/engine/breakdown';
import { DetailView } from '../../src/ui/screens/MonthDetail';
import { item, txn } from '../fixtures/engine';

const recurring = [
  item({ id: 'salary', name: 'משכורת', kind: 'income', amount: 2070000 }),
  item({ id: 'child', name: 'קצבת ילדים', kind: 'income', amount: 27600 }),
  item({ id: 'rent', name: 'שכר דירה', kind: 'fixed', amount: 840000 }),
];
const txns = [
  txn({ date: '2026-11-02', amount: 2230400, kind: 'income', recurringItemId: 'salary' }),
  txn({ date: '2026-11-05', amount: 30000, merchant: 'יוחננוף', categoryId: 'super' }),
  txn({ date: '2026-11-07', amount: 12000, merchant: 'שופרסל', categoryId: 'super' }),
  txn({ date: '2026-11-06', amount: 87700, merchant: 'בסטה בר', categoryId: 'out' }),
];
const b = breakdown({ month: '2026-11', recurring, funds: [], txns, carryIn: 0 });
const categories = [{ id: 'super', name: 'סופר', sort: 1 }, { id: 'out', name: 'אוכל בחוץ', sort: 2 }];
const show = (kind: 'income' | 'fixed' | 'variable') =>
  render(<MemoryRouter><DetailView kind={kind} month="2026-11" b={b} categories={categories} /></MemoryRouter>);

test('income lists what came in and what is still expected', () => {
  show('income');
  expect(screen.getByRole('heading', { name: 'הכנסות · נובמבר 2026' })).toBeInTheDocument();
  expect(screen.getByText('משכורת').closest('.detail-line')).toHaveTextContent('התקבל 22,304 ₪');
  expect(screen.getByText('משכורת').closest('.detail-line')).toHaveTextContent('צפוי 20,700 ₪');
  expect(screen.getByText('קצבת ילדים').closest('.detail-line')).toHaveTextContent('צפוי 276 ₪');
  expect(screen.getByText('קצבת ילדים').closest('.detail-line')).toHaveTextContent('עוד לא התקבל');
});

test('fixed lists what was paid', () => {
  show('fixed');
  expect(screen.getByText('שכר דירה').closest('.detail-line')).toHaveTextContent('עוד לא שולם');
});

test('variable groups spending by category, largest first, with each transaction', () => {
  show('variable');
  const cats = screen.getAllByTestId('category').map((e) => e.textContent);
  expect(cats).toEqual(['אוכל בחוץ877 ₪', 'סופר420 ₪']);
  expect(screen.getByRole('link', { name: /בסטה בר/ })).toBeInTheDocument();
});
