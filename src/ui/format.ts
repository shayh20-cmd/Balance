import type { ISODate, Month } from '../engine/types';

const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function monthName(m: Month): string {
  return monthNames[Number(m.slice(5, 7)) - 1];
}

/** 2026-11-02 → 2.11.2026 */
export function shortDate(d: ISODate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day}.${m}.${y}`;
}
