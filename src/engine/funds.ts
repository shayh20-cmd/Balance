import { monthOf, monthsBetween } from './dates';
import type { Agorot, Fund, Month, Txn } from './types';

export function fundProvision(f: Fund, m: Month): Agorot {
  if (f.isGeneral) return 0;
  const monthsLeft = monthsBetween(m, monthOf(f.targetDate));
  const remaining = f.target - f.balance;
  if (monthsLeft < 0 || remaining <= 0) return 0;
  return Math.ceil(remaining / Math.max(1, monthsLeft));
}

export function fundOverspend(f: Fund, m: Month, txns: Txn[]): Agorot {
  const spent = txns
    .filter((t) => t.kind === 'expense' && t.fundId === f.id && monthOf(t.date) === m && !t.isCardSettlement)
    .reduce((a, t) => a + t.amount, 0);
  return Math.max(0, spent - (f.balance + fundProvision(f, m)));
}
