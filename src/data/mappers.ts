import { monthOf } from '../engine/dates';
import { fundBalanceBefore, type FundFlow } from '../engine/funds';
import type { Fund, Month, RecurringItem, Txn, TxnFields } from '../engine/types';

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
  card_last4: string | null;
  import_key: string | null;
  needs_review: boolean;
  category_name_hint: string | null;
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
  end_month: string | null; // date, first of month
  variable_amount: boolean;
  installment_key: string | null;
}

export interface FundRow {
  id: string;
  household_id: string;
  name: string;
  target_agorot: number;
  target_date: string;
  is_general: boolean;
  annual: boolean;
  created_at: string;
}

export interface FundEntryRow {
  fund_id: string;
  month: string;
  amount_agorot: number;
  kind: 'provision' | 'deposit' | 'withdrawal' | 'adjust';
}

/** A transaction linked to a fund, from before the month being loaded. */
export interface FundSpendRow {
  fund_id: string;
  date: string;
  amount_agorot: number;
  kind: Txn['kind'];
}

export function rowToTxn(r: TxnRow): Txn {
  return {
    id: r.id, date: r.date, amount: r.amount_agorot, kind: r.kind, merchant: r.merchant, categoryId: r.category_id,
    recurringItemId: r.recurring_item_id, fundId: r.fund_id, isCardSettlement: r.is_card_settlement,
    source: r.source, memberId: r.member_id, status: r.status,
    cardLast4: r.card_last4 ?? null, importKey: r.import_key ?? null, needsReview: r.needs_review ?? false,
  };
}

export function txnToRow(t: TxnFields & { id?: string }, householdId: string): Partial<TxnRow> {
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
    endMonth: r.end_month ? r.end_month.slice(0, 7) : null, variableAmount: r.variable_amount ?? false,
    installmentKey: r.installment_key ?? null,
  };
}

export function recurringToRow(i: Omit<RecurringItem, 'id'> & { id?: string }, householdId: string): Partial<RecurringRow> {
  return {
    ...(i.id ? { id: i.id } : {}),
    household_id: householdId, kind: i.kind, name: i.name, amount_agorot: i.amount, day_of_month: i.dayOfMonth,
    interval_months: i.intervalMonths, start_month: `${i.startMonth}-01`, paid_by: i.paidBy, active: i.active,
    end_month: i.endMonth ? `${i.endMonth}-01` : null, variable_amount: i.variableAmount, installment_key: i.installmentKey,
  };
}

/**
 * balance = the replay in fundBalanceBefore from the fund's creation month. Provision entries are implied by
 * the replay and ignored; deposits and adjustments add, withdrawals and linked expenses subtract.
 */
export function rowToFund(r: FundRow, entries: FundEntryRow[], month: Month, spent: FundSpendRow[]): Fund {
  const flows: Record<Month, FundFlow> = {};
  const flow = (m: Month) => (flows[m] ??= { deposits: 0, spent: 0 });
  for (const e of entries) {
    if (e.fund_id !== r.id || e.kind === 'provision') continue;
    flow(e.month.slice(0, 7)).deposits += e.kind === 'withdrawal' ? -e.amount_agorot : e.amount_agorot;
  }
  for (const t of spent) {
    if (t.fund_id === r.id && t.kind === 'expense') flow(monthOf(t.date)).spent += t.amount_agorot;
  }
  const fund = { target: r.target_agorot, targetDate: r.target_date, isGeneral: r.is_general };
  const balance = fundBalanceBefore(fund, monthOf(r.created_at.slice(0, 10)), month, flows);
  return { id: r.id, name: r.name, ...fund, balance };
}
