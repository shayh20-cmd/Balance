import { monthOf } from './dates';
import { expectedAmount, isDueInMonth, isVariable, type MonthInput } from './month';
import type { Agorot, Txn } from './types';

/** One income or fixed expense of the month: what was expected and what actually came in or went out. */
export interface Line {
  id: string;
  name: string;
  /** 0 for income that has no item of its own. */
  expected: Agorot;
  /** The linked transactions' total, or null when nothing came yet. */
  actual: Agorot | null;
  txns: Txn[];
}

export interface Breakdown {
  income: Line[];
  fixed: Line[];
  variable: Txn[];
  /** Income that actually came in. */
  received: Agorot;
  /** Fixed expenses actually paid. */
  paidFixed: Agorot;
}

const sum = (xs: Txn[]) => xs.reduce((a, t) => a + t.amount, 0);

/**
 * The month's numbers line by line, by the same rules as computeMonth: a linked actual replaces the expected
 * amount (even off-cycle), an item with nothing linked counts only when due, card settlements are left out.
 * Summing (actual ?? expected) over the lines gives computeMonth's income and fixed.
 */
export function breakdown(input: MonthInput): Breakdown {
  const { month, recurring, history } = input;
  const txns = input.txns.filter((t) => monthOf(t.date) === month && !t.isCardSettlement);

  const lines = (kind: 'income' | 'fixed'): Line[] =>
    recurring
      .filter((i) => i.kind === kind)
      .map((i) => {
        const linked = txns.filter((t) => t.recurringItemId === i.id);
        return {
          id: i.id, name: i.name, expected: expectedAmount(i, history?.[i.id], month),
          actual: linked.length ? sum(linked) : null, txns: linked, due: isDueInMonth(i, month),
        };
      })
      .filter((l) => l.due || l.actual !== null)
      .map(({ due: _due, ...l }) => l);

  const extraIncome: Line[] = txns
    .filter((t) => t.kind === 'income' && !t.recurringItemId)
    .map((t) => ({ id: t.id, name: t.merchant || 'הכנסה', expected: 0, actual: t.amount, txns: [t] }));

  const income = [...lines('income'), ...extraIncome];
  const fixed = lines('fixed');
  const paid = (ls: Line[]) => ls.reduce((a, l) => a + (l.actual ?? 0), 0);
  return {
    income, fixed,
    variable: txns.filter(isVariable).sort((a, b) => b.date.localeCompare(a.date)),
    received: paid(income), paidFixed: paid(fixed),
  };
}
