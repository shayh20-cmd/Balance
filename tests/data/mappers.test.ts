import { recurringToRow, rowToFund, rowToRecurring, rowToTxn, txnToRow, type FundEntryRow, type TxnRow } from '../../src/data/mappers';

const txnRow: TxnRow = {
  id: 't1', household_id: 'h1', member_id: 'u1', date: '2026-11-05', amount_agorot: 34200, kind: 'expense',
  merchant: 'שופרסל', category_id: 'c1', recurring_item_id: null, fund_id: null, is_card_settlement: false,
  source: 'apple_pay', status: 'pending', installment_group: null, installment_index: null, installment_count: null, note: null,
};

test('a transaction row converts to a Txn and back', () => {
  const t = rowToTxn(txnRow);
  expect(t).toEqual({
    id: 't1', date: '2026-11-05', amount: 34200, kind: 'expense', merchant: 'שופרסל', categoryId: 'c1',
    recurringItemId: null, fundId: null, isCardSettlement: false, source: 'apple_pay', memberId: 'u1', status: 'pending',
  });
  const { installment_group, installment_index, installment_count, note, ...core } = txnRow;
  expect(txnToRow(t, 'h1')).toEqual(core);
});

test('recurring start_month date becomes a Month and back', () => {
  const r = rowToRecurring({
    id: 'r1', household_id: 'h1', kind: 'fixed', name: 'ארנונה', amount_agorot: 80000, day_of_month: 10,
    interval_months: 2, start_month: '2026-02-01', paid_by: 'bank', category_id: null, active: true,
  });
  expect(r).toEqual({ id: 'r1', kind: 'fixed', name: 'ארנונה', amount: 80000, dayOfMonth: 10, intervalMonths: 2, startMonth: '2026-02', active: true, paidBy: 'bank' });
  expect(recurringToRow(r, 'h1').start_month).toBe('2026-02-01');
});

test('fund balance sums entries before the computed month', () => {
  const entries: FundEntryRow[] = [
    { fund_id: 'f1', month: '2026-10-01', amount_agorot: 50000, kind: 'provision' },
    { fund_id: 'f1', month: '2026-10-01', amount_agorot: 30000, kind: 'deposit' },
    { fund_id: 'f1', month: '2026-10-01', amount_agorot: 20000, kind: 'withdrawal' },
    { fund_id: 'f1', month: '2026-11-01', amount_agorot: 10000, kind: 'deposit' },
    { fund_id: 'f2', month: '2026-10-01', amount_agorot: 99999, kind: 'deposit' },
  ];
  const f = rowToFund({ id: 'f1', household_id: 'h1', name: 'רכב', target_agorot: 380000, target_date: '2027-03-01', is_general: false, annual: true }, entries, '2026-11');
  expect(f).toEqual({ id: 'f1', name: 'רכב', target: 380000, targetDate: '2027-03-01', balance: 60000, isGeneral: false });
});
