import { recurringToRow, rowToFund, rowToRecurring, rowToTxn, txnToRow, type FundEntryRow, type FundSpendRow, type TxnRow } from '../../src/data/mappers';

const txnRow: TxnRow = {
  id: 't1', household_id: 'h1', member_id: 'u1', date: '2026-11-05', amount_agorot: 34200, kind: 'expense',
  merchant: 'שופרסל', category_id: 'c1', recurring_item_id: null, fund_id: null, is_card_settlement: false,
  source: 'apple_pay', status: 'pending', installment_group: null, installment_index: null, installment_count: null, note: null,
  card_last4: '5218', import_key: null, needs_review: true, category_name_hint: null,
};

test('a transaction row converts to a Txn and back', () => {
  const t = rowToTxn(txnRow);
  expect(t).toEqual({
    id: 't1', date: '2026-11-05', amount: 34200, kind: 'expense', merchant: 'שופרסל', categoryId: 'c1',
    recurringItemId: null, fundId: null, isCardSettlement: false, source: 'apple_pay', memberId: 'u1', status: 'pending',
    cardLast4: '5218', importKey: null, needsReview: true, categoryHint: null,
  });
  const { installment_group, installment_index, installment_count, note, card_last4, import_key, needs_review, category_name_hint, ...core } = txnRow;
  expect(txnToRow(t, 'h1')).toEqual(core);
});

test('recurring start_month date becomes a Month and back', () => {
  const r = rowToRecurring({
    id: 'r1', household_id: 'h1', kind: 'fixed', name: 'ארנונה', amount_agorot: 80000, day_of_month: 10,
    interval_months: 2, start_month: '2026-02-01', paid_by: 'bank', category_id: null, active: true,
    end_month: null, variable_amount: false, installment_key: null, merchant_key: null,
  });
  expect(r).toEqual({
    id: 'r1', kind: 'fixed', name: 'ארנונה', amount: 80000, dayOfMonth: 10, intervalMonths: 2, startMonth: '2026-02', active: true,
    paidBy: 'bank', endMonth: null, variableAmount: false, installmentKey: null, merchantKey: null,
  });
  expect(recurringToRow(r, 'h1').start_month).toBe('2026-02-01');
});

test('a recurring row with end_month converts and back', () => {
  const r = rowToRecurring({
    id: 'r2', household_id: 'h1', kind: 'fixed', name: 'ליברה (תשלומים)', amount_agorot: 12200, day_of_month: 22,
    interval_months: 1, start_month: '2026-06-01', paid_by: 'card', category_id: null, active: true,
    end_month: '2027-03-01', variable_amount: true, installment_key: 'inst:1111:2026-06-22:ליברה:10', merchant_key: 'ליברה',
  });
  expect(r).toMatchObject({ endMonth: '2027-03', variableAmount: true, installmentKey: 'inst:1111:2026-06-22:ליברה:10' });
  expect(recurringToRow(r, 'h1')).toMatchObject({ end_month: '2027-03-01', variable_amount: true, installment_key: 'inst:1111:2026-06-22:ליברה:10' });
});

test('fund balance replays provisions, deposits and fund spending from the creation month', () => {
  const entries: FundEntryRow[] = [
    { fund_id: 'f1', month: '2026-10-01', amount_agorot: 50000, kind: 'provision' }, // implied by the replay, ignored
    { fund_id: 'f1', month: '2026-10-01', amount_agorot: 30000, kind: 'deposit' },
    { fund_id: 'f1', month: '2026-10-01', amount_agorot: 20000, kind: 'withdrawal' },
    { fund_id: 'f1', month: '2026-11-01', amount_agorot: 10000, kind: 'deposit' }, // this month: not yet in the balance
    { fund_id: 'f2', month: '2026-10-01', amount_agorot: 99999, kind: 'deposit' },
  ];
  const spent: FundSpendRow[] = [
    { fund_id: 'f1', date: '2026-10-20', amount_agorot: 6000, kind: 'expense' },
    { fund_id: 'f2', date: '2026-10-20', amount_agorot: 5000, kind: 'expense' },
  ];
  const row = { id: 'f1', household_id: 'h1', name: 'רכב', target_agorot: 380000, target_date: '2027-03-01', is_general: false, annual: true, created_at: '2026-10-12T08:00:00Z' };
  // October: +30000 −20000 deposits, provision ceil(370000/5) = 74000, −6000 spent → 78000
  expect(rowToFund(row, entries, '2026-11', spent)).toEqual({ id: 'f1', name: 'רכב', target: 380000, targetDate: '2027-03-01', balance: 78000, isGeneral: false });
});
