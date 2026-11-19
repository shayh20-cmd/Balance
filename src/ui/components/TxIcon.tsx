import type { Txn } from '../../engine/types';
import Icon, { type IconName } from './Icon';

const byCategory: Record<string, IconName> = {
  'סופר': 'cart', 'אוכל בחוץ': 'utensils', 'דלק ותחבורה': 'car', 'בריאות': 'heart', 'ילדים': 'baby',
  'פנאי': 'ticket', 'קניות': 'bag', 'בית': 'home',
};

/** Income gets the "in" arrow, a payment of a fixed item the repeat sign, anything else its category's icon. */
export function iconFor(t: Txn, categoryName: string | null): IconName {
  if (t.kind === 'income') return 'income';
  if (t.recurringItemId) return 'repeat';
  return (categoryName && byCategory[categoryName]) || 'dots';
}

export default function TxIcon({ txn, categoryName }: { txn: Txn; categoryName: string | null }) {
  const kind = txn.kind === 'income' ? ' income' : txn.recurringItemId ? ' fixed' : '';
  return (
    <span className={`tx-icon${kind}`} aria-hidden="true">
      <Icon name={iconFor(txn, categoryName)} />
    </span>
  );
}
