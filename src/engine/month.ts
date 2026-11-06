import { monthOf, monthsBetween } from './dates';
import type { Agorot, Fund, Month, RecurringItem, Txn } from './types';

export interface MonthInput {
  month: Month;
  recurring: RecurringItem[];
  funds: Fund[];
  txns: Txn[];
  carryIn: Agorot; // from the previous month's close (plan 4); 0 until then
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
  const diff = monthsBetween(item.startMonth, m);
  return diff >= 0 && diff % item.intervalMonths === 0;
}

export function isVariable(t: Txn): boolean {
  return t.kind === 'expense' && !t.recurringItemId && !t.fundId && !t.isCardSettlement;
}

const sum = (xs: Txn[]) => xs.reduce((a, t) => a + t.amount, 0);

/** Recurring totals: the linked actuals of a due item replace its expected amount. */
function recurringTotal(items: RecurringItem[], kind: RecurringItem['kind'], m: Month, txns: Txn[]): Agorot {
  return items
    .filter((i) => i.kind === kind && isDueInMonth(i, m))
    .reduce((a, i) => {
      const linked = txns.filter((t) => t.recurringItemId === i.id);
      return a + (linked.length ? sum(linked) : i.amount);
    }, 0);
}

export function computeMonth(input: MonthInput): MonthSummary {
  const { month, recurring, txns: all, carryIn } = input;
  const txns = all.filter((t) => monthOf(t.date) === month && !t.isCardSettlement);
  const income = recurringTotal(recurring, 'income', month, txns) + sum(txns.filter((t) => t.kind === 'income' && !t.recurringItemId));
  const fixed = recurringTotal(recurring, 'fixed', month, txns);
  const fundProvision = 0;
  const fundOverspend = 0;
  const variableBudget = income - fixed - fundProvision + carryIn;
  const variableSpent = sum(txns.filter(isVariable)) + fundOverspend;
  return { month, income, fixed, fundProvision, fundOverspend, variableBudget, variableSpent, leftToSpend: variableBudget - variableSpent };
}
