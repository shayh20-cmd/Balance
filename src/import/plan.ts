import type { TxnRow } from '../data/mappers';
import { addMonths, monthOf } from '../engine/dates';
import { matchRows } from '../engine/match';
import { merchantKey } from '../engine/merchant';
import type { Agorot, ISODate, RecurringItem, Txn } from '../engine/types';
import { leumiCategoryToOurs } from './categories';
import { linkRecurring, type CheckingFile, type Link, type LinkRow } from './leumiChecking';
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

const emptyPlan = (bankBalance: ImportPlan['bankBalance'] = null): ImportPlan => ({
  updates: [], inserts: [], bankBalance, summary: { matched: 0, added: 0, review: 0, skipped: 0 },
});

/**
 * Links rows to fixed items and income, over every month the rows touch. A link to an item that already has a
 * transaction that month is uncertain too: it may be the same payment entered by hand.
 */
function links(rows: LinkRow[], items: RecurringItem[], existing: Txn[]): Map<string, Link> {
  // Neighbouring months too: a salary paid on the 30th belongs to next month's item.
  const months = [...new Set(rows.flatMap((r) => [-1, 0, 1].map((n) => addMonths(monthOf(r.date), n))))].sort();
  const dateOf = new Map(rows.map((r) => [r.importKey, r.date]));
  const out = new Map<string, Link>();
  for (const l of linkRecurring(rows, items, months)) {
    const m = monthOf(dateOf.get(l.rowKey)!);
    const paid = existing.some((t) => t.recurringItemId === l.itemId && monthOf(t.date) === m);
    out.set(l.rowKey, { ...l, uncertain: l.uncertain || paid });
  }
  return out;
}

/**
 * Card export → updates for transactions already captured (file data wins, the person's category stays) and
 * inserts for the rest. Rows already imported only move pending → confirmed. Card-paid fixed items link to
 * their rows, and a pending captured transaction on this card that the file doesn't have goes to review.
 */
export function planCardImport(
  file: CardFile, existing: Txn[], categories: CategoryRef[], householdId: string, memberId: string,
  items: RecurringItem[] = [], rules: { merchantKey: string; categoryId: string }[] = [],
): ImportPlan {
  // A rule learned from the person's correction wins over Leumi's category.
  const ruled = new Map(rules.map((r) => [r.merchantKey, r.categoryId]));
  const categoryFor = (r: ImportedRow) =>
    ruled.get(merchantKey(r.merchant)) ?? categories.find((c) => c.name === leumiCategoryToOurs(r.categoryHint))?.id ?? null;
  const byKey = new Map(existing.filter((t) => t.importKey).map((t) => [t.importKey!, t]));
  const plan = emptyPlan();

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
  const linkable = [...m.matched.map((x) => x.row), ...m.unmatched].map((r) => ({
    date: r.date, amount: r.amount, kind: 'expense' as const, isCardSettlement: false, importKey: r.importKey,
  }));
  const linked = links(linkable, items.filter((i) => i.paidBy === 'card'), existing);

  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const { txnId, row, uncertain } of m.matched) {
    const t = byId.get(txnId)!;
    const l = linked.get(row.importKey);
    const review = uncertain || !!l?.uncertain;
    plan.updates.push({
      id: txnId,
      patch: {
        date: row.date, amount_agorot: row.amount, merchant: row.merchant, status: row.pending ? 'pending' : 'confirmed',
        card_last4: row.cardLast4, import_key: row.importKey, category_name_hint: row.categoryHint,
        ...(t.categoryId ? {} : { category_id: categoryFor(row) }),
        ...(l && !t.recurringItemId ? { recurring_item_id: l.itemId } : {}),
        ...(review ? { needs_review: true } : {}),
      },
    });
    if (review) plan.summary.review++;
  }
  plan.summary.matched += m.matched.length;

  for (const r of m.unmatched) {
    const l = linked.get(r.importKey);
    if (l?.uncertain) plan.summary.review++;
    plan.inserts.push({
      ...blank(householdId, memberId),
      date: r.date, amount_agorot: r.amount, kind: 'expense', merchant: r.merchant, category_id: categoryFor(r),
      recurring_item_id: l?.itemId ?? null, status: r.pending ? 'pending' : 'confirmed',
      installment_index: r.installment?.index ?? null, installment_count: r.installment?.count ?? null,
      card_last4: r.cardLast4, import_key: r.importKey, needs_review: !!l?.uncertain, category_name_hint: r.categoryHint,
    });
  }
  plan.summary.added = plan.inserts.length;

  // Spec §7.3: an instant transaction that never showed up in its file is flagged.
  const dates = file.rows.map((r) => r.date).sort();
  if (dates.length && file.cardLast4) {
    const matchedIds = new Set(m.matched.map((x) => x.txnId));
    for (const t of existing) {
      if (t.importKey === null && t.status === 'pending' && !t.needsReview && t.cardLast4 === file.cardLast4 &&
          t.date >= dates[0] && t.date <= dates[dates.length - 1] && !matchedIds.has(t.id)) {
        plan.updates.push({ id: t.id, patch: { needs_review: true } });
        plan.summary.review++;
      }
    }
  }
  return plan;
}

/**
 * Checking export → one insert per new row, card settlements flagged, fixed items and income linked. A row
 * that matches a hand-entered transaction (amount, date ±1) confirms it instead of adding a copy; the
 * person's own description stays, since bank descriptions say less.
 */
export function planCheckingImport(file: CheckingFile, existing: Txn[], items: RecurringItem[], householdId: string, memberId: string): ImportPlan {
  const known = new Set(existing.map((t) => t.importKey).filter(Boolean));
  const fresh = file.rows.filter((r) => !known.has(r.importKey));
  const plan = emptyPlan(file.balance);
  plan.summary.skipped = file.rows.length - fresh.length;

  const linked = links(fresh, items.filter((i) => i.paidBy === 'bank'), existing);
  const m = matchRows(
    existing,
    fresh.filter((r) => !r.isCardSettlement).map((r) => ({ ...r, cardLast4: null })),
    { bank: true },
  );
  const byId = new Map(existing.map((t) => [t.id, t]));
  const matchedKeys = new Set<string>();
  for (const { txnId, row, uncertain } of m.matched) {
    matchedKeys.add(row.importKey);
    const t = byId.get(txnId)!;
    const l = linked.get(row.importKey);
    const review = uncertain || !!l?.uncertain;
    plan.updates.push({
      id: txnId,
      patch: {
        date: row.date, status: 'confirmed', import_key: row.importKey,
        ...(l && !t.recurringItemId ? { recurring_item_id: l.itemId } : {}),
        ...(review ? { needs_review: true } : {}),
      },
    });
    if (review) plan.summary.review++;
    else plan.summary.matched++;
  }

  for (const r of fresh) {
    if (matchedKeys.has(r.importKey)) continue;
    const l = linked.get(r.importKey);
    plan.inserts.push({
      ...blank(householdId, memberId),
      date: r.date, amount_agorot: r.amount, kind: r.kind, merchant: r.description, recurring_item_id: l?.itemId ?? null,
      is_card_settlement: r.isCardSettlement, status: 'confirmed', import_key: r.importKey, needs_review: !!l?.uncertain,
    });
    if (l?.uncertain) plan.summary.review++;
    else if (l) plan.summary.matched++;
  }
  plan.summary.added = plan.inserts.length;
  return plan;
}

