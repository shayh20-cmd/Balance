import { addMonths, monthOf } from '../engine/dates';
import { detectRecurring, type RecurringSuggestion } from '../engine/detect';
import type { ISODate, Month, RecurringItem, Txn } from '../engine/types';
import type { ImportPlan } from '../import/plan';
import { rowToRecurring, rowToTxn, type RecurringRow, type TxnRow } from './mappers';
import { currentUserId, loadDismissals, loadRecentTxns } from './repo';
import { supabase } from './supabase';

export interface InboxItem { id: string; title: string; body: string; createdAt: string }

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Every transaction dated from..to inclusive: what a file's rows may match or already be. */
export async function loadForImport(householdId: string, from: ISODate, to: ISODate): Promise<Txn[]> {
  const rows = check(await supabase.from('transactions').select('*').eq('household_id', householdId).gte('date', from).lte('date', to));
  return (rows as TxnRow[]).map(rowToTxn);
}

/**
 * Carries a plan out: updates one by one, then inserts that skip any import_key already present (a second
 * tab or a double click), then the bank balance unless a newer one is already stored.
 */
export async function applyPlan(householdId: string, plan: ImportPlan): Promise<void> {
  for (const u of plan.updates) {
    check(await supabase.from('transactions').update(u.patch).eq('id', u.id).eq('household_id', householdId));
  }
  if (plan.inserts.length) {
    check(await supabase.from('transactions').upsert(plan.inserts, { onConflict: 'household_id,import_key', ignoreDuplicates: true }));
  }
  if (plan.bankBalance) {
    const current = check(await supabase.from('bank_balance').select('as_of').eq('household_id', householdId).maybeSingle()) as { as_of: string } | null;
    if (!current || current.as_of <= plan.bankBalance.asOf) {
      check(await supabase.from('bank_balance').upsert({
        household_id: householdId, amount_agorot: plan.bankBalance.amount, as_of: plan.bankBalance.asOf,
      }));
    }
  }
}

export async function monthCloses(householdId: string): Promise<Month[]> {
  const rows = check(await supabase.from('month_closes').select('month').eq('household_id', householdId)) as { month: string }[];
  return rows.map((r) => r.month.slice(0, 7));
}

export async function closeMonth(householdId: string, month: Month): Promise<void> {
  const uid = await currentUserId();
  check(await supabase.from('month_closes').upsert({ household_id: householdId, month: `${month}-01`, closed_by: uid }));
}

export interface ImportCount { label: string; count: number }

/** Rows that came from files, per month: which card (by last 4) or the checking account, and how many. */
export function summarizeImports(rows: { date: string; card_last4: string | null; import_key: string }[]): Record<Month, ImportCount[]> {
  const out: Record<Month, ImportCount[]> = {};
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    const label = r.import_key.startsWith('bank:') ? 'עו"ש' : r.card_last4 ?? 'כרטיס';
    const list = (out[m] ??= []);
    const hit = list.find((x) => x.label === label);
    if (hit) hit.count++;
    else list.push({ label, count: 1 });
  }
  return out;
}

export async function loadImports(householdId: string, from: ISODate): Promise<Record<Month, ImportCount[]>> {
  const rows = check(await supabase.from('transactions').select('date, card_last4, import_key').eq('household_id', householdId)
    .not('import_key', 'is', null).gte('date', from)) as { date: string; card_last4: string | null; import_key: string }[];
  return summarizeImports(rows);
}

/** Undoes a close: the month counts as open again and the reminder comes back. */
export async function reopenMonth(householdId: string, month: Month): Promise<void> {
  check(await supabase.from('month_closes').delete().eq('household_id', householdId).eq('month', `${month}-01`));
}

export async function reviewItems(householdId: string): Promise<{ txns: Txn[]; inbox: InboxItem[]; items: RecurringItem[] }> {
  const [txns, inbox, items] = await Promise.all([
    supabase.from('transactions').select('*').eq('household_id', householdId).eq('needs_review', true).order('date'),
    supabase.from('ingest_inbox').select('id, title, body, created_at').eq('household_id', householdId).is('resolved_at', null).order('created_at'),
    supabase.from('recurring_items').select('*').eq('household_id', householdId),
  ]);
  return {
    items: (check(items) as RecurringRow[]).map(rowToRecurring),
    txns: (check(txns) as TxnRow[]).map(rowToTxn),
    inbox: (check(inbox) as { id: string; title: string; body: string; created_at: string }[]).map((r) => ({
      id: r.id, title: r.title, body: r.body, createdAt: r.created_at,
    })),
  };
}

/** Merchants that look recurring over the last 4 full months (§7.4). */
export async function loadSuggestions(householdId: string, today: ISODate): Promise<RecurringSuggestion[]> {
  const [txns, dismissed, items] = await Promise.all([
    loadRecentTxns(householdId, `${addMonths(monthOf(today), -4)}-01`),
    loadDismissals(householdId),
    supabase.from('recurring_items').select('*').eq('household_id', householdId),
  ]);
  return detectRecurring(txns, (check(items) as RecurringRow[]).map(rowToRecurring), dismissed, today);
}

/** How many things wait in the review screen. */
export async function reviewCount(householdId: string, today: ISODate): Promise<number> {
  const suggestions = loadSuggestions(householdId, today).then((s) => s.length, () => 0);
  const [t, i] = await Promise.all([
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('household_id', householdId).eq('needs_review', true),
    supabase.from('ingest_inbox').select('id', { count: 'exact', head: true }).eq('household_id', householdId).is('resolved_at', null),
  ]);
  if (t.error) throw new Error(t.error.message);
  if (i.error) throw new Error(i.error.message);
  return (t.count ?? 0) + (i.count ?? 0) + (await suggestions);
}

export async function resolveInbox(id: string): Promise<void> {
  check(await supabase.from('ingest_inbox').update({ resolved_at: new Date().toISOString() }).eq('id', id));
}

export async function markReviewed(txnId: string): Promise<void> {
  check(await supabase.from('transactions').update({ needs_review: false }).eq('id', txnId));
}
