import { addMonths, daysInMonth } from '../engine/dates';
import { toAgorot } from '../engine/money';
import type { Agorot, ISODate } from '../engine/types';
import type { CardFile, ImportedRow, Sheet } from './types';

const COL = {
  date: 'תאריך עסקה',
  merchant: 'שם בית העסק',
  category: 'קטגוריה',
  last4: '4 ספרות אחרונות של כרטיס האשראי',
  charged: 'סכום חיוב',
  original: 'סכום עסקה מקורי',
  currency: 'מטבע עסקה מקורי',
  notes: 'הערות',
} as const;
const TOTAL = 'סך הכל';

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** A cell holding a number, or text like "1,234.50₪", as agorot. null when empty. */
export function cellAgorot(v: unknown): Agorot | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 100);
  const t = String(v).replace(/[₪\s‎‏]/g, '');
  return t === '' ? null : toAgorot(t);
}

/** DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, or a Date cell, as YYYY-MM-DD. */
export function cellDate(v: unknown): ISODate | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/.exec(text(v));
  if (!m) return null;
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** The purchase date moved forward by n months, day clamped to the target month. */
function shiftMonths(d: ISODate, n: number): ISODate {
  const m = addMonths(d.slice(0, 7), n);
  const day = Math.min(Number(d.slice(8, 10)), daysInMonth(m));
  return `${m}-${String(day).padStart(2, '0')}`;
}

function headerIndex(rows: unknown[][]): number {
  return rows.findIndex((r) => r.some((c) => text(c) === COL.date));
}

export function parseLeumiCard(sheets: Sheet[]): CardFile {
  const usable = sheets.filter((s) => headerIndex(s.rows) >= 0);
  if (usable.length === 0) throw new Error('not_leumi_card');

  let cardLast4 = '';
  let billingMonth = '';
  let chargedTotal = 0;
  const rows: Omit<ImportedRow, 'importKey'>[] = [];

  for (const s of usable) {
    const h = headerIndex(s.rows);
    const pending = s.name.includes('טרם נקלטו');
    for (const r of s.rows.slice(0, h)) {
      const t = text(r[0]);
      const card = /^(\d{4})-/.exec(t);
      if (card && !cardLast4) cardLast4 = card[1];
      const bm = /^(\d{1,2})\/(\d{4})$/.exec(t);
      if (bm && !billingMonth) billingMonth = `${bm[2]}-${bm[1].padStart(2, '0')}`;
    }
    const cols = new Map(s.rows[h].map((c, i) => [text(c), i]));
    const cell = (r: unknown[], name: string) => {
      const i = cols.get(name);
      return i === undefined ? undefined : r[i];
    };

    let i = h + 1;
    for (; i < s.rows.length; i++) {
      const r = s.rows[i];
      const purchase = cellDate(cell(r, COL.date));
      if (!purchase) break;
      // A pending row only has the original amount; in a foreign currency it isn't shekels yet. It comes in
      // when it is charged.
      const currency = text(cell(r, COL.currency));
      if (pending && currency && currency !== '₪') continue;
      const amount = (pending ? null : cellAgorot(cell(r, COL.charged))) ?? cellAgorot(cell(r, COL.original));
      if (amount === null) continue;
      const inst = /תשלום\s+(\d+)\s+מתוך\s+(\d+)/.exec(text(cell(r, COL.notes)));
      const installment = inst ? { index: Number(inst[1]), count: Number(inst[2]), purchaseDate: purchase } : null;
      const last4 = text(cell(r, COL.last4)) || null;
      rows.push({
        date: installment ? shiftMonths(purchase, installment.index - 1) : purchase,
        amount,
        merchant: text(cell(r, COL.merchant)),
        cardLast4: last4,
        categoryHint: text(cell(r, COL.category)) || null,
        installment,
        pending,
      });
    }
    if (!pending) {
      const t = s.rows.slice(i).findIndex((r) => text(r[0]) === TOTAL);
      const totalRow = t >= 0 ? s.rows[i + t + 1] : undefined;
      chargedTotal += (totalRow && cellAgorot(totalRow[0])) ?? 0;
    }
  }

  if (!cardLast4) cardLast4 = rows.find((r) => r.cardLast4)?.cardLast4 ?? '';
  const seen = new Map<string, number>();
  const keyed = rows.map((r) => {
    const base = `card:${r.cardLast4 ?? cardLast4}:${r.date}:${r.amount}:${r.merchant}:${r.installment?.index ?? 0}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, importKey: `${base}#${n}` };
  });
  return { cardLast4, billingMonth, rows: keyed, chargedTotal };
}
