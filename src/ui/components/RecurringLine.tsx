import { formatShekels } from '../../engine/money';
import type { Agorot, Month, RecurringItem } from '../../engine/types';
import { monthName } from '../format';
import Amount from './Amount';

const intervalText = (n: number) => (n === 1 ? 'כל חודש' : `כל ${n} חודשים`);

export function endMonthError(start: Month, end: string): string | null {
  return end && end < start ? 'החודש האחרון לפני חודש ההתחלה' : null;
}

/** One fixed item or income in the list: how often, who pays, when it ends, what is expected this month. */
export default function RecurringLine({ item, expected, onEdit, onDelete }: {
  item: RecurringItem; expected: Agorot; onEdit: () => void; onDelete: () => void;
}) {
  const parts = [intervalText(item.intervalMonths)];
  if (item.kind === 'fixed') parts.push(item.paidBy === 'card' ? 'אשראי' : 'בנק');
  if (item.variableAmount) parts.push(`משתנה · צפוי ${formatShekels(expected)}`);
  if (item.endMonth) parts.push(`עד ${monthName(item.endMonth)} ${item.endMonth.slice(0, 4)}`);
  if (item.installmentKey) parts.push('נוצר מקובץ האשראי');
  return (
    <div className="row">
      <button type="button" className="link-button" onClick={onEdit}>
        {item.name}
        <span className="muted">{` · ${parts.join(' · ')}`}</span>
      </button>
      <span>
        <Amount value={expected} />
        <button type="button" className="danger" aria-label={`מחיקת ${item.name}`} onClick={onDelete}>✕</button>
      </span>
    </div>
  );
}
