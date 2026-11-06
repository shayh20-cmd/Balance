import { addMonths, daysInMonth, monthOf } from './dates';
import type { Agorot, ISODate } from './types';

export function splitInstallments(
  total: Agorot,
  count: number,
  firstDate: ISODate,
): { date: ISODate; amount: Agorot; index: number }[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  const day = Number(firstDate.slice(8, 10));
  return Array.from({ length: count }, (_, i) => {
    const m = addMonths(monthOf(firstDate), i);
    const d = Math.min(day, daysInMonth(m));
    return { date: `${m}-${String(d).padStart(2, '0')}`, amount: base + (i === 0 ? remainder : 0), index: i + 1 };
  });
}
