import { addMonths } from '../engine/dates';
import { splitInstallments } from '../engine/installments';
import type { MonthInput } from '../engine/month';
import type { Agorot, Fund, ISODate, Month, RecurringItem, Txn, TxnFields } from '../engine/types';
import {
  recurringToRow, rowToFund, rowToRecurring, rowToTxn, txnToRow,
  type FundEntryRow, type FundRow, type FundSpendRow, type RecurringRow, type TxnRow,
} from './mappers';
import { merchantKey } from '../engine/merchant';
import { supabase } from './supabase';

export interface Household { id: string; name: string; role: 'owner' | 'member'; displayName: string }
export interface Category { id: string; name: string; sort: number }
export interface Member { userId: string; displayName: string; role: 'owner' | 'member' }
export interface BankBalance { amount: Agorot; asOf: ISODate }
export interface FundDetails extends Fund { annual: boolean }
export type MonthData = Omit<MonthInput, 'funds'> & { categories: Category[]; members: Member[]; bankBalance: BankBalance | null; funds: FundDetails[] };
export type TxnDraft = Omit<TxnFields, 'status'> & { note?: string | null };

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not_signed_in');
  return data.user.id;
}

export async function getMyHousehold(): Promise<Household | null> {
  const uid = await currentUserId();
  const rows = check(
    await supabase.from('members').select('household_id, role, display_name, households(name)').eq('user_id', uid),
  ) as unknown as { household_id: string; role: Household['role']; display_name: string; households: { name: string } | null }[];
  const r = rows[0];
  return r ? { id: r.household_id, name: r.households?.name ?? '', role: r.role, displayName: r.display_name } : null;
}

export async function createHousehold(name: string, displayName: string): Promise<string> {
  return check(await supabase.rpc('create_household', { p_name: name, p_display_name: displayName })) as string;
}

export async function createInvite(email: string): Promise<string> {
  return check(await supabase.rpc('create_invite', { p_email: email })) as string;
}

export async function acceptInvite(token: string, displayName: string): Promise<string> {
  return check(await supabase.rpc('accept_invite', { p_token: token, p_display_name: displayName })) as string;
}

export async function loadMonth(householdId: string, month: Month): Promise<MonthData> {
  const from = `${month}-01`;
  const to = `${addMonths(month, 1)}-01`;
  const [txns, recurring, funds, entries, categories, members, bank, fundSpend, linked] = await Promise.all([
    supabase.from('transactions').select('*').eq('household_id', householdId).gte('date', from).lt('date', to)
      .order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('recurring_items').select('*').eq('household_id', householdId).order('created_at'),
    supabase.from('funds').select('*').eq('household_id', householdId).order('created_at'),
    supabase.from('fund_entries').select('fund_id, month, amount_agorot, kind').eq('household_id', householdId),
    supabase.from('categories').select('id, name, sort').eq('household_id', householdId).order('sort'),
    supabase.from('members').select('user_id, display_name, role').eq('household_id', householdId),
    supabase.from('bank_balance').select('amount_agorot, as_of').eq('household_id', householdId).maybeSingle(),
    // earlier spending from funds, so each fund's balance can be replayed
    supabase.from('transactions').select('fund_id, date, amount_agorot, kind').eq('household_id', householdId)
      .not('fund_id', 'is', null).lt('date', from),
    // linked actuals of the last 6 months, for variable-amount items' expected amount
    supabase.from('transactions').select('recurring_item_id, date, amount_agorot').eq('household_id', householdId)
      .not('recurring_item_id', 'is', null).gte('date', `${addMonths(month, -6)}-01`).lt('date', from),
  ]);
  const history: Record<string, Record<Month, Agorot>> = {};
  for (const r of check(linked) as { recurring_item_id: string; date: string; amount_agorot: number }[]) {
    const h = (history[r.recurring_item_id] ??= {});
    const m = r.date.slice(0, 7);
    h[m] = (h[m] ?? 0) + r.amount_agorot;
  }
  const spendRows = check(fundSpend) as FundSpendRow[];
  const entryRows = check(entries) as FundEntryRow[];
  const bankRow = check(bank) as { amount_agorot: number; as_of: string } | null;
  const memberRows = check(members) as { user_id: string; display_name: string; role: Member['role'] }[];
  return {
    month,
    txns: (check(txns) as TxnRow[]).map(rowToTxn),
    recurring: (check(recurring) as RecurringRow[]).map(rowToRecurring),
    funds: (check(funds) as FundRow[]).map((r) => ({ ...rowToFund(r, entryRows, month, spendRows), annual: r.annual })),
    carryIn: 0,
    history,
    categories: check(categories) as Category[],
    members: memberRows.map((m) => ({ userId: m.user_id, displayName: m.display_name, role: m.role })),
    bankBalance: bankRow ? { amount: bankRow.amount_agorot, asOf: bankRow.as_of } : null,
  };
}

export async function addTransaction(householdId: string, draft: TxnDraft, installments = 1): Promise<void> {
  const base = { ...txnToRow({ ...draft, status: 'confirmed' }, householdId), note: draft.note ?? null };
  if (installments <= 1) {
    check(await supabase.from('transactions').insert(base));
    return;
  }
  const group = crypto.randomUUID();
  const rows = splitInstallments(draft.amount, installments, draft.date).map((p) => ({
    ...base, date: p.date, amount_agorot: p.amount,
    installment_group: group, installment_index: p.index, installment_count: installments,
  }));
  check(await supabase.from('transactions').insert(rows));
}

export async function getTransaction(id: string): Promise<Txn & { note: string | null }> {
  const row = check(await supabase.from('transactions').select('*').eq('id', id).single()) as TxnRow;
  return { ...rowToTxn(row), note: row.note };
}

export async function updateTransaction(id: string, patch: Partial<TxnDraft>): Promise<void> {
  const columns: [keyof TxnDraft, string][] = [
    ['date', 'date'], ['amount', 'amount_agorot'], ['kind', 'kind'], ['merchant', 'merchant'],
    ['categoryId', 'category_id'], ['recurringItemId', 'recurring_item_id'], ['fundId', 'fund_id'], ['note', 'note'],
  ];
  const row: Record<string, unknown> = {};
  for (const [key, column] of columns) if (patch[key] !== undefined) row[column] = patch[key];
  check(await supabase.from('transactions').update(row).eq('id', id));
}

export async function deleteTransaction(id: string): Promise<void> {
  check(await supabase.from('transactions').delete().eq('id', id));
}

export async function upsertRecurring(householdId: string, item: Omit<RecurringItem, 'id'> & { id?: string }): Promise<void> {
  check(await supabase.from('recurring_items').upsert(recurringToRow(item, householdId)));
}

export async function deleteRecurring(id: string): Promise<void> {
  check(await supabase.from('recurring_items').delete().eq('id', id));
}

export async function upsertFund(
  householdId: string,
  f: { id?: string; name: string; target: Agorot; targetDate: ISODate; annual: boolean },
): Promise<void> {
  check(await supabase.from('funds').upsert({
    ...(f.id ? { id: f.id } : {}), household_id: householdId, name: f.name,
    target_agorot: f.target, target_date: f.targetDate, annual: f.annual,
  }));
}

export async function deleteFund(id: string): Promise<void> {
  check(await supabase.from('funds').delete().eq('id', id).eq('is_general', false));
}

export interface Device { id: string; name: string; lastSeenAt: string | null; token: string }

export async function listDevices(householdId: string): Promise<Device[]> {
  const rows = check(
    await supabase.from('devices').select('id, name, last_seen_at, token').eq('household_id', householdId)
      .is('revoked_at', null).order('created_at'),
  ) as { id: string; name: string; last_seen_at: string | null; token: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name, lastSeenAt: r.last_seen_at, token: r.token }));
}

export async function createDevice(name: string): Promise<string> {
  return check(await supabase.rpc('create_device', { p_name: name })) as string;
}

export async function revokeDevice(id: string): Promise<void> {
  check(await supabase.from('devices').update({ revoked_at: new Date().toISOString() }).eq('id', id));
}

export async function setBankBalance(householdId: string, amount: Agorot, asOf: ISODate): Promise<void> {
  check(await supabase.from('bank_balance').upsert({ household_id: householdId, amount_agorot: amount, as_of: asOf }));
}

export interface CategoryRule { merchantKey: string; categoryId: string }

export async function loadCategoryRules(householdId: string): Promise<CategoryRule[]> {
  const rows = check(await supabase.from('category_rules').select('merchant_key, category_id').eq('household_id', householdId)) as
    { merchant_key: string; category_id: string }[];
  return rows.map((r) => ({ merchantKey: r.merchant_key, categoryId: r.category_id }));
}

/** Remembers "this merchant → this category" for future imports. An empty key is skipped. */
export async function saveCategoryRule(householdId: string, merchant: string, categoryId: string): Promise<void> {
  const key = merchantKey(merchant);
  if (!key) return;
  check(await supabase.from('category_rules').upsert({
    household_id: householdId, merchant_key: key, category_id: categoryId, updated_at: new Date().toISOString(),
  }));
}

export async function loadDismissals(householdId: string): Promise<string[]> {
  const rows = check(await supabase.from('recurring_dismissals').select('merchant_key').eq('household_id', householdId)) as { merchant_key: string }[];
  return rows.map((r) => r.merchant_key);
}

export async function dismissRecurring(householdId: string, key: string): Promise<void> {
  check(await supabase.from('recurring_dismissals').upsert({ household_id: householdId, merchant_key: key }));
}

/** Adds installment items, skipping any installment_key already present; returns how many were new. */
export async function upsertInstallmentItems(householdId: string, drafts: Omit<RecurringItem, 'id'>[]): Promise<number> {
  if (drafts.length === 0) return 0;
  const rows = check(await supabase.from('recurring_items')
    .upsert(drafts.map((d) => recurringToRow(d, householdId)), { onConflict: 'household_id,installment_key', ignoreDuplicates: true })
    .select('id')) as { id: string }[] | null;
  return rows?.length ?? 0;
}

/** Transactions since `from`, for spotting recurring merchants. */
export async function loadRecentTxns(householdId: string, from: ISODate): Promise<Txn[]> {
  const rows = check(await supabase.from('transactions').select('*').eq('household_id', householdId).gte('date', from));
  return (rows as TxnRow[]).map(rowToTxn);
}

/** A confirmed link teaches a card-paid item the merchant it is charged under. */
export async function learnItemMerchant(itemId: string, merchant: string): Promise<void> {
  const key = merchantKey(merchant);
  if (!key) return;
  check(await supabase.from('recurring_items').update({ merchant_key: key }).eq('id', itemId).eq('paid_by', 'card'));
}

/** "Not related": the transaction goes back to ordinary spending. */
export async function unlinkTransaction(txnId: string): Promise<void> {
  check(await supabase.from('transactions').update({ recurring_item_id: null, needs_review: false }).eq('id', txnId));
}
