import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TransactionForm from '../../src/ui/components/TransactionForm';
import { fund, item } from '../fixtures/engine';

const props = {
  categories: [{ id: 'c1', name: 'סופר', sort: 1 }],
  recurring: [item({ id: 'salary', kind: 'income' as const, amount: 1500000, name: 'משכורת' }), item({ id: 'rent', kind: 'fixed' as const, amount: 600000, name: 'שכירות' })],
  funds: [fund({ id: 'car', target: 380000, targetDate: '2027-03-01', name: 'רכב' })],
  today: '2026-11-06',
};

test('amount "1,200" with 3 installments submits 120000 agorot and 3 installments', async () => {
  const onSubmit = vi.fn();
  render(<TransactionForm {...props} onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText('סכום'), '1,200');
  await userEvent.type(screen.getByLabelText('בית עסק / תיאור'), 'מקרר');
  await userEvent.clear(screen.getByLabelText('מספר תשלומים'));
  await userEvent.type(screen.getByLabelText('מספר תשלומים'), '3');
  await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 120000, kind: 'expense', merchant: 'מקרר', date: '2026-11-06', source: 'manual', fundId: null, recurringItemId: null }),
    3,
  );
});

test('an invalid amount shows "סכום לא תקין" and does not submit', async () => {
  const onSubmit = vi.fn();
  render(<TransactionForm {...props} onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText('סכום'), 'abc');
  await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
  expect(screen.getByText('סכום לא תקין')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('income hides funds and installments and offers only income items', async () => {
  render(<TransactionForm {...props} onSubmit={vi.fn()} />);
  expect(screen.getByRole('option', { name: 'קופה: רכב' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'הכנסה' }));
  expect(screen.queryByRole('option', { name: 'קופה: רכב' })).toBeNull();
  expect(screen.queryByLabelText('מספר תשלומים')).toBeNull();
  expect(screen.getByRole('option', { name: 'משכורת' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'שכירות' })).toBeNull();
});

test('choosing a fund links the expense to it', async () => {
  const onSubmit = vi.fn();
  render(<TransactionForm {...props} onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText('סכום'), '1150');
  await userEvent.selectOptions(screen.getByLabelText('שיוך'), 'fund:car');
  await userEvent.click(screen.getByRole('button', { name: 'שמירה' }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fundId: 'car', recurringItemId: null, amount: 115000 }), 1);
});

test('editing a category saves a rule for the merchant', async () => {
  const { ruleToSave } = await import('../../src/ui/screens/AddTransaction');
  const before = { merchant: 'EXPRESS 7', categoryId: 'c1' };
  expect(ruleToSave(before, { merchant: 'EXPRESS 7', categoryId: 'c2' })).toEqual({ merchant: 'EXPRESS 7', categoryId: 'c2' });
  expect(ruleToSave(before, { merchant: 'EXPRESS 7', categoryId: 'c1' })).toBeNull();
  expect(ruleToSave(before, { merchant: 'EXPRESS 7', categoryId: null })).toBeNull();
  expect(ruleToSave(undefined, { merchant: 'EXPRESS 7', categoryId: 'c2' })).toBeNull();
});

test('the form explains where the category came from', async () => {
  const { categoryOrigin } = await import('../../src/ui/screens/AddTransaction');
  const t = { merchant: 'EXPRESS 7', categoryHint: 'מזון וצריכה' };
  expect(categoryOrigin(t, [{ merchantKey: 'express', categoryId: 'c1' }])).toBe('לפי כלל שלמד מתיקון שלך');
  expect(categoryOrigin(t, [])).toBe('לפי הקטגוריה של לאומי: מזון וצריכה');
  expect(categoryOrigin({ merchant: 'x', categoryHint: null }, [])).toBeNull();
  render(<TransactionForm {...props} onSubmit={vi.fn()} categoryOrigin="לפי כלל שלמד מתיקון שלך" />);
  expect(screen.getByText('לפי כלל שלמד מתיקון שלך')).toBeInTheDocument();
});
