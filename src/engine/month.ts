import { monthOf, monthsBetween } from './dates';
import { fundOverspend as overspendOf, fundProvision as provisionOf } from './funds';
import type { Agorot, Fund, Month, RecurringItem, Txn } from './types';

export interface MonthInput {
  month: Month;
  recurring: RecurringItem[];
  funds: Fund[];
  txns: Txn[];
  carryIn: Agorot; // from the previous month's close (plan 4); 0 until then
  /** Per item id, the sum of linked actuals per earlier month (for variable-amount items). */
  history?: Record<string, Record<Month, Agorot>>;
}

export interface MonthSummary {
  month: Month;
  income: Agorot;
  fixed: Agorot;
  fundProvision: Agorot;
  fundOverspend: Agorot;
  variableBudget: Agorot;
  variableSpent: Agorot;
  leftToSpend: Agorot;
}

export function isDueInMonth(item: RecurringItem, m: Month): boolean {
  if (!item.active) return false;
  if (item.endMonth && m > item.endMonth) return false;
  const diff = monthsBetween(item.startMonth, m);
  return diff >= 0 && diff % item.intervalMonths === 0;
}

export function isVariable(t: Txn): boolean {
  return t.kind === 'expense' && !t.recurringItemId && !t.fundId && !t.isCardSettlement;
}

const sum = (xs: Txn[]) => xs.reduce((a, t) => a + t.amount, 0);

/** A variable item expects the average of its last 3 months with actuals before m; otherwise its amount. */
export function expectedAmount(item: RecurringItem, history: Record<Month, Agorot> | undefined, m: Month): Agorot {
  if (!item.variableAmount || !history) return item.amount;
  const recent = Object.keys(history).filter((k) => k < m).sort().slice(-3);
  if (recent.length === 0) return item.amount;
  return Math.round(recent.reduce((a, k) => a + history[k], 0) / recent.length);
}

/**
 * Recurring totals: an item's linked actuals replace its expected amount. Linked actuals count even in a
 * month the item isn't due (paid early or off-cycle), and an item with nothing linked counts only when due.
 */
function recurringTotal(items: RecurringItem[], kind: RecurringItem['kind'], m: Month, txns: Txn[], history: MonthInput['history']): Agorot {
  return items
    .filter((i) => i.kind === kind)
    .reduce((a, i) => {
      const linked = txns.filter((t) => t.recurringItemId === i.id);
      if (linked.length) return a + sum(linked);
      return a + (isDueInMonth(i, m) ? expectedAmount(i, history?.[i.id], m) : 0);
    }, 0);
}

export function computeMonth(input: MonthInput): MonthSummary {
  const { month, recurring, txns: all, carryIn, history } = input;
  const txns = all.filter((t) => monthOf(t.date) === month && !t.isCardSettlement);
  const income = recurringTotal(recurring, 'income', month, txns, history) + sum(txns.filter((t) => t.kind === 'income' && !t.recurringItemId));
  const fixed = recurringTotal(recurring, 'fixed', month, txns, history);
  const fundProvision = input.funds.reduce((a, f) => a + provisionOf(f, month), 0);
  const fundOverspend = input.funds.reduce((a, f) => a + overspendOf(f, month, txns), 0);
  const variableBudget = income - fixed - fundProvision + carryIn;
  const variableSpent = sum(txns.filter(isVariable)) + fundOverspend;
  return { month, income, fixed, fundProvision, fundOverspend, variableBudget, variableSpent, leftToSpend: variableBudget - variableSpent };
}
