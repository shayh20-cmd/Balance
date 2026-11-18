import { addMonths, monthOf } from '../engine/dates';
import type { RecurringItem } from '../engine/types';
import type { CardFile } from './types';

/**
 * Card rows paid in installments ("תשלום k מתוך n") become temporary fixed items, from the month of the
 * row seen to the last installment (not from the first one: earlier months would expect payments that were
 * already counted, or happened before the household used the app), so future months already expect them. One draft per purchase whose key no
 * item carries yet; upserting by installment_key keeps a re-upload from doubling them.
 */
/** The first installment usually carries the rounding; the rest share what is left of the total. */
function regular(amount: number, inst: { index: number; count: number; total: number }): number {
  return inst.index === 1 ? Math.round((inst.total - amount) / (inst.count - 1)) : amount;
}

export function installmentDrafts(file: CardFile, items: RecurringItem[]): Omit<RecurringItem, 'id'>[] {
  const known = new Set(items.map((i) => i.installmentKey).filter(Boolean));
  const out: Omit<RecurringItem, 'id'>[] = [];
  for (const r of file.rows) {
    const inst = r.installment;
    if (!inst || inst.count < 2) continue;
    // The purchase total tells apart two same-day purchases at one merchant (it is the same on every installment).
    const key = `inst:${r.cardLast4 ?? file.cardLast4}:${inst.purchaseDate}:${r.merchant}:${inst.count}:${inst.total}`;
    if (known.has(key)) continue;
    known.add(key);
    const firstMonth = monthOf(inst.purchaseDate);
    out.push({
      kind: 'fixed', name: `${r.merchant} (תשלומים)`, amount: regular(r.amount, inst), dayOfMonth: Number(inst.purchaseDate.slice(8, 10)),
      intervalMonths: 1, startMonth: monthOf(r.date), endMonth: addMonths(firstMonth, inst.count - 1), active: true, paidBy: 'card',
      variableAmount: false, installmentKey: key,
    });
  }
  return out;
}
