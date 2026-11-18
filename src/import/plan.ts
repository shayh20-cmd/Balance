import type { TxnRow } from '../data/mappers';
import { monthOf } from '../engine/dates';
import { matchRows } from '../engine/match';
import type { Agorot, ISODate, Month, RecurringItem, Txn } from '../engine/types';
import { leumiCategoryToOurs } from './categories';
import { linkRecurring, type CheckingFile, type CheckingRow } from './leumiChecking';
import type { CardFile, ImportedRow } from './types';

export type TxnRowPatch = Omit<TxnRow, 'id' | 'household_id'>;
export type TxnInsert = Omit<TxnRow, 'id'>;
export interface TxnUpdate { id: string; patch: Partial<TxnRowPatch> }
export interface ImportPlan {
  updates: TxnUpdate[];
  inserts: TxnInsert[];
  bankBalance: { amount: Agorot; asOf: ISODate } | null;
  summary: { matched: number; added: number; review: number; skipped: number };
}
type CategoryRef = { id: string; name: string };

const blank = (householdId: string, memberId: string) => ({
  household_id: householdId, member_id: memberId, category_id: null, recurring_item_id: null, fund_id: null,
  is_card_settlement: false, source: 'file' as const, installment_group: null, installment_index: null,
  installment_count: null, note: null, card_last4: null, import_key: null, needs_review: false, category_name_hint: null,
});

/**
 * Card export → updates for transactions already captured (file data wins, the person's category stays) and
 * inserts for the rest. Rows already imported only move pending → confirmed.
 */
export function planCardImport(file: CardFile, existing: Txn[], categories: CategoryRef[], householdId: string, memberId: string): ImportPlan {
  const categoryFor = (r: ImportedRow) => categories.find((c) => c.name === leumiCategoryToOurs(r.categoryHint))?.id ?? null;
  const byKey = new Map(existing.filter((t) => t.importKey).map((t) => [t.importKey!, t]));
  const plan: ImportPlan = { updates: [], inserts: [], bankBalance: null, summary: { matched: 0, added: 0, review: 0, skipped: 0 } };

  for (const r of file.rows) {
    const t = byKey.get(r.importKey);
    if (!t) continue;
    if (t.status === 'pending' && !r.pending) {
      plan.updates.push({ id: t.id, patch: { status: 'confirmed' } });
      plan.summary.matched++;
    } else {
      plan.summary.skipped++;
    }
  }

  const m = matchRows(existing, file.rows);
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const { txnId, row } of m.matched) {
    const t = byId.get(txnId)!;
    const category = t.categoryId ? {} : { category_id: categoryFor(row) };
    plan.updates.push({
      id: txnId,
      patch: {
        date: row.date, amount_agorot: row.amount, merchant: row.merchant, status: row.pending ? 'pending' : 'confirmed',
        card_last4: row.cardLast4, import_key: row.importKey, category_name_hint: row.categoryHint, ...category,
      },
    });
  }
  plan.summary.matched += m.matched.length;

  const insert = (r: ImportedRow, review: boolean): TxnInsert => ({
    ...blank(householdId, memberId),
    date: r.date, amount_agorot: r.amount, kind: 'expense', merchant: r.merchant, category_id: categoryFor(r),
    status: r.pending ? 'pending' : 'confirmed', installment_index: r.installment?.index ?? null,
    installment_count: r.installment?.count ?? null, card_last4: r.cardLast4, import_key: r.importKey,
    needs_review: review, category_name_hint: r.categoryHint,
  });
  plan.inserts.push(...m.unmatched.map((r) => insert(r, false)), ...m.ambiguous.map((r) => insert(r, true)));
  plan.summary.added = plan.inserts.length;
  plan.summary.review = m.ambiguous.length;
  return plan;
}

/**
 * Checking export → one insert per new row, card settlements flagged, fixed items and income linked. A row
 * that links to an item already paid that month is linked but sent to review: it may be the same payment.
 */
export function planCheckingImport(file: CheckingFile, existing: Txn[], items: RecurringItem[], householdId: string, memberId: string): ImportPlan {
  const known = new Set(existing.map((t) => t.importKey).filter(Boolean));
  const fresh = file.rows.filter((r) => !known.has(r.importKey));
  const plan: ImportPlan = {
    updates: [], inserts: [], bankBalance: file.balance,
    summary: { matched: 0, added: 0, review: 0, skipped: file.rows.length - fresh.length },
  };

  const months = new Map<Month, CheckingRow[]>();
  for (const r of fresh) months.set(monthOf(r.date), [...(months.get(monthOf(r.date)) ?? []), r]);
  const links = new Map<string, string>();
  for (const [month, rows] of months) {
    for (const l of linkRecurring(rows, items, month)) links.set(l.rowKey, l.itemId);
  }
  const paid = (itemId: string, month: Month) =>
    existing.some((t) => t.recurringItemId === itemId && monthOf(t.date) === month);

  for (const r of fresh) {
    const itemId = links.get(r.importKey) ?? null;
    const review = itemId !== null && paid(itemId, monthOf(r.date));
    plan.inserts.push({
      ...blank(householdId, memberId),
      date: r.date, amount_agorot: r.amount, kind: r.kind, merchant: r.description, recurring_item_id: itemId,
      is_card_settlement: r.isCardSettlement, status: 'confirmed', import_key: r.importKey, needs_review: review,
    });
    if (review) plan.summary.review++;
    else if (itemId) plan.summary.matched++;
  }
  plan.summary.added = plan.inserts.length;
  return plan;
}
