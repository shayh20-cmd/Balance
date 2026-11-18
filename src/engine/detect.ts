import { addMonths, monthOf } from './dates';
import { merchantKey } from './merchant';
import type { Agorot, ISODate, Month, RecurringItem, Txn } from './types';

export interface RecurringSuggestion {
  merchantKey: string;
  merchant: string;
  kind: 'income' | 'fixed';
  amount: Agorot;
  dayOfMonth: number;
  paidBy: 'bank' | 'card';
  /** The evidence, oldest first. */
  months: Month[];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/**
 * "Looks recurring" (§7.4): a merchant with exactly one transaction in each of at least 3 consecutive months
 * of the last 4 full months, every amount within ±15% of the median. Several visits a month (a supermarket)
 * never qualify. Linked, fund and settlement transactions, dismissed merchants and existing items are skipped.
 */
export function detectRecurring(txns: Txn[], items: RecurringItem[], dismissed: string[], today: ISODate): RecurringSuggestion[] {
  const current = monthOf(today);
  const window = [-4, -3, -2, -1].map((n) => addMonths(current, n));
  const skip = new Set([...dismissed, ...items.map((i) => merchantKey(i.name))]);

  const byKey = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.recurringItemId || t.fundId || t.isCardSettlement || !window.includes(monthOf(t.date))) continue;
    const key = merchantKey(t.merchant);
    if (!key || skip.has(key)) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }

  const out: RecurringSuggestion[] = [];
  for (const [key, list] of byKey) {
    // the longest run of consecutive months with exactly one transaction each
    let best: Txn[] = [];
    let run: Txn[] = [];
    for (const m of window) {
      const inMonth = list.filter((t) => monthOf(t.date) === m);
      run = inMonth.length === 1 ? [...run, inMonth[0]] : [];
      if (run.length > best.length) best = run;
    }
    if (best.length < 3) continue;
    const kinds = new Set(best.map((t) => t.kind));
    if (kinds.size !== 1) continue;
    const amount = median(best.map((t) => t.amount));
    if (best.some((t) => Math.abs(t.amount - amount) > Math.abs(amount) * 0.15)) continue;
    out.push({
      merchantKey: key,
      merchant: best[best.length - 1].merchant,
      kind: best[0].kind === 'income' ? 'income' : 'fixed',
      amount,
      dayOfMonth: median(best.map((t) => Number(t.date.slice(8, 10)))),
      paidBy: best.some((t) => t.cardLast4) ? 'card' : 'bank',
      months: best.map((t) => monthOf(t.date)),
    });
  }
  return out;
}
