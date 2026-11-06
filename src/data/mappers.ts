import type { Fund, Month, RecurringItem, Txn } from '../engine/types';

export interface TxnRow {
  id: string;
  household_id: string;
  member_id: string;
  date: string;
  amount_agorot: number;
  kind: Txn['kind'];
  merchant: string;
  category_id: string | null;
  recurring_item_id: string | null;
  fund_id: string | null;
  is_card_settlement: boolean;
  source: Txn['source'];
  status: Txn['status'];
  installment_group: string | null;
  installment_index: number | null;
  installment_count: number | null;
  note: string | null;
}

export interface RecurringRow {
  id: string;
  household_id: string;
  kind: RecurringItem['kind'];
  name: string;
  amount_agorot: number;
  day_of_month: number;
  interval_months: number;
  start_month: string; // date, first of month
  paid_by: RecurringItem['paidBy'];
  category_id: string | null;
  active: boolean;
}

export interface FundRow {
  id: string;
  household_id: string;
  name: string;
  target_agorot: number;
  target_date: string;
  is_general: boolean;
  annual: boolean;
}

export interface FundEntryRow {
  fund_id: string;
  month: string;
  amount_agorot: number;
  kind: 'provision' | 'deposit' | 'withdrawal' | 'adjust';
}

export function rowToTxn(r: TxnRow): Txn {
  return {
    id: r.id, date: r.date, amount: r.amount_agorot, kind: r.kind, merchant: r.merchant, categoryId: r.category_id,
    recurringItemId: r.recurring_item_id, fundId: r.fund_id, isCardSettlement: r.is_card_settlement,
    source: r.source, memberId: r.member_id, status: r.status,
  };
}

export function txnToRow(t: Omit<Txn, 'id'> & { id?: string }, householdId: string): Partial<TxnRow> {
  return {
    ...(t.id ? { id: t.id } : {}),
    household_id: householdId, member_id: t.memberId, date: t.date, amount_agorot: t.amount, kind: t.kind,
    merchant: t.merchant, category_id: t.categoryId, recurring_item_id: t.recurringItemId, fund_id: t.fundId,
    is_card_settlement: t.isCardSettlement, source: t.source, status: t.status,
  };
}

export function rowToRecurring(r: RecurringRow): RecurringItem {
  return {
    id: r.id, kind: r.kind, name: r.name, amount: r.amount_agorot, dayOfMonth: r.day_of_month,
    intervalMonths: r.interval_months, startMonth: r.start_month.slice(0, 7), active: r.active, paidBy: r.paid_by,
  };
}

export function recurringToRow(i: Omit<RecurringItem, 'id'> & { id?: string }, householdId: string): Partial<RecurringRow> {
  return {
    ...(i.id ? { id: i.id } : {}),
    household_id: householdId, kind: i.kind, name: i.name, amount_agorot: i.amount, day_of_month: i.dayOfMonth,
    interval_months: i.intervalMonths, start_month: `${i.startMonth}-01`, paid_by: i.paidBy, active: i.active,
  };
}

/** balance = the fund's entries dated before `month`; withdrawals count negative. */
export function rowToFund(r: FundRow, entries: FundEntryRow[], month: Month): Fund {
  const balance = entries
    .filter((e) => e.fund_id === r.id && e.month.slice(0, 7) < month)
    .reduce((a, e) => a + (e.kind === 'withdrawal' ? -e.amount_agorot : e.amount_agorot), 0);
  return { id: r.id, name: r.name, target: r.target_agorot, targetDate: r.target_date, balance, isGeneral: r.is_general };
}
