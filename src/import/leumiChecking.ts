import { daysBetweenInclusive, daysInMonth, monthOf } from '../engine/dates';
import { isDueInMonth } from '../engine/month';
import type { Agorot, ISODate, Month, RecurringItem } from '../engine/types';
import { cellAgorot, cellDate } from './leumiCard';
import type { Sheet } from './types';

export interface CheckingRow {
  date: ISODate;
  description: string;
  /** Always positive; kind says which column held it. */
  amount: Agorot;
  kind: 'income' | 'expense';
  isCardSettlement: boolean;
  /** bank:<date>:<kind>:<amount>:<description>#<n> */
  importKey: string;
}

export interface CheckingFile {
  rows: CheckingRow[];
  balance: { amount: Agorot; asOf: ISODate } | null;
}

const DESCRIPTION = ['סוג תנועה', 'תיאור', 'תיאור התנועה', 'פרטים'];
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** Card companies' monthly debits. Short names must stand alone ("כאל" is inside "מיכאל"). */
const SETTLEMENT_LONG = ['לאומי ויזה', 'לאומי מאסטרקרד', 'לאומי מאסטרקארד', 'לאומי קארד', 'ישראכרט', 'אמריקן אקספרס', 'דיינרס'];
const SETTLEMENT_WORD = /(?<![\p{L}])(כאל|מקס|max)(?![\p{L}])/iu;
export function isCardSettlementText(description: string): boolean {
  return SETTLEMENT_LONG.some((s) => description.includes(s)) || SETTLEMENT_WORD.test(description);
}

export function parseLeumiChecking(sheets: Sheet[]): CheckingFile {
  for (const s of sheets) {
    const h = s.rows.findIndex((r) => {
      const cells = r.map(text);
      return cells.includes('תאריך') && cells.includes('זכות') && cells.includes('חובה');
    });
    if (h < 0) continue;
    const head = s.rows[h].map(text);
    const col = (names: string[]) => head.findIndex((c) => names.includes(c));
    const iDate = head.indexOf('תאריך');
    const iDesc = col(DESCRIPTION);
    const iCredit = head.indexOf('זכות');
    const iDebit = head.indexOf('חובה');
    const iBalance = head.indexOf('יתרה מצטברת');

    const seen = new Map<string, number>();
    const rows: CheckingRow[] = [];
    let balance: CheckingFile['balance'] = null;
    for (const r of s.rows.slice(h + 1)) {
      const date = cellDate(r[iDate]);
      if (!date) continue;
      const credit = cellAgorot(r[iCredit]);
      const debit = cellAgorot(r[iDebit]);
      const kind = credit ? 'income' : 'expense';
      const amount = Math.abs((credit || debit) ?? 0);
      if (amount === 0) continue;
      const description = iDesc >= 0 ? text(r[iDesc]) : '';
      const base = `bank:${date}:${kind}:${amount}:${description}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      rows.push({ date, description, amount, kind, isCardSettlement: kind === 'expense' && isCardSettlementText(description), importKey: `${base}#${n}` });
      // Newest row wins; on the same day the first one listed (Leumi lists newest first).
      const bal = iBalance >= 0 ? cellAgorot(r[iBalance]) : null;
      if (bal !== null && (!balance || date > balance.asOf)) balance = { amount: bal, asOf: date };
    }
    return { rows, balance };
  }
  throw new Error('not_leumi_checking');
}

/** What linking needs from a row; card rows fit too. */
export type LinkRow = Pick<CheckingRow, 'date' | 'amount' | 'kind' | 'isCardSettlement' | 'importKey'>;
export interface Link { rowKey: string; itemId: string; uncertain: boolean }

/**
 * Pairs each fixed item and income due in `months` with its row, same kind. First a sure pass: within ±20% of
 * the expected amount and ±6 days of its day of month, in that month. Then, for what is left, a wider pass
 * (±50%, ±10 days, across the month edge) whose links are uncertain: a bonus month or a late cheque would
 * otherwise count both the expected amount and the real row. Closest amounts pair first; each row and item
 * links once. The caller filters items by who pays them (bank or card).
 */
export function linkRecurring(rows: LinkRow[], items: RecurringItem[], months: Month | Month[]): Link[] {
  const ms = Array.isArray(months) ? months : [months];
  const usedRows = new Set<string>();
  const usedItems = new Set<string>();
  const out: Link[] = [];

  const pass = (maxOff: (it: RecurringItem) => number, maxDays: number, sameMonth: boolean, uncertain: boolean) => {
    const pairs: { rowKey: string; itemKey: string; itemId: string; off: number }[] = [];
    for (const month of ms) {
      for (const it of items) {
        const itemKey = `${it.id}@${month}`;
        if (usedItems.has(itemKey) || !isDueInMonth(it, month)) continue;
        const due = `${month}-${String(Math.min(it.dayOfMonth, daysInMonth(month))).padStart(2, '0')}`;
        const kind = it.kind === 'income' ? 'income' : 'expense';
        for (const r of rows) {
          if (usedRows.has(r.importKey) || r.kind !== kind || r.isCardSettlement) continue;
          if (sameMonth && monthOf(r.date) !== month) continue;
          const off = Math.abs(r.amount - it.amount) / Math.max(it.amount, 1);
          const days = Math.abs(daysBetweenInclusive(due, r.date) - 1);
          if (off <= maxOff(it) && days <= maxDays) pairs.push({ rowKey: r.importKey, itemKey, itemId: it.id, off });
        }
      }
    }
    pairs.sort((a, b) => a.off - b.off);
    for (const p of pairs) {
      if (usedRows.has(p.rowKey) || usedItems.has(p.itemKey)) continue;
      usedRows.add(p.rowKey);
      usedItems.add(p.itemKey);
      out.push({ rowKey: p.rowKey, itemId: p.itemId, uncertain });
    }
  };
  // A variable-amount item (water, electricity) is sure within ±50%.
  pass((it) => (it.variableAmount ? 0.5 : 0.2), 6, true, false);
  pass(() => 0.5, 10, false, true);
  return out;
}
