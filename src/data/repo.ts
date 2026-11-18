import { addMonths } from '../engine/dates';
import { splitInstallments } from '../engine/installments';
import type { MonthInput } from '../engine/month';
import type { Agorot, Fund, ISODate, Month, RecurringItem, Txn, TxnFields } from '../engine/types';
import {
  recurringToRow, rowToFund, rowToRecurring, rowToTxn, txnToRow,
  type FundEntryRow, type FundRow, type FundSpendRow, type RecurringRow, type TxnRow,
} from './mappers';
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
  const [txns, recurring, funds, entries, categories, members, bank, fundSpend] = await Promise.all([
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
  ]);
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
