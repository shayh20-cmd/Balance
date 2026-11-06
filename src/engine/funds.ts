import { addMonths, monthOf, monthsBetween } from './dates';
import type { Agorot, Fund, Month, Txn } from './types';

export function fundProvision(f: Fund, m: Month): Agorot {
  if (f.isGeneral) return 0;
  const monthsLeft = monthsBetween(m, monthOf(f.targetDate));
  const remaining = f.target - f.balance;
  if (monthsLeft < 0 || remaining <= 0) return 0;
  return Math.ceil(remaining / Math.max(1, monthsLeft));
}

export interface FundFlow {
  deposits: Agorot; // deposits and adjustments minus withdrawals
  spent: Agorot; // expenses linked to the fund
}

/**
 * The balance a fund holds at the start of `m`, replaying every month from `startMonth`:
 * each month's provision counts as saved, and spending from the fund comes out of it (never below 0;
 * spending beyond the balance was already counted as variable overspend in that month).
 */
export function fundBalanceBefore(
  f: Pick<Fund, 'target' | 'targetDate' | 'isGeneral'>,
  startMonth: Month,
  m: Month,
  flows: Record<Month, FundFlow>,
): Agorot {
  let balance = 0;
  for (let k = startMonth; monthsBetween(k, m) > 0; k = addMonths(k, 1)) {
    const flow = flows[k] ?? { deposits: 0, spent: 0 };
    balance += flow.deposits;
    const provision = fundProvision({ ...f, id: '', name: '', balance }, k);
    balance = Math.max(0, balance + provision - flow.spent);
  }
  return balance;
}

export function fundOverspend(f: Fund, m: Month, txns: Txn[]): Agorot {
  const spent = txns
    .filter((t) => t.kind === 'expense' && t.fundId === f.id && monthOf(t.date) === m && !t.isCardSettlement)
    .reduce((a, t) => a + t.amount, 0);
  return Math.max(0, spent - (f.balance + fundProvision(f, m)));
}
