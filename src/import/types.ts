import type { Agorot, ISODate, Month } from '../engine/types';

/** One worksheet as plain rows of cell values. */
export interface Sheet {
  name: string;
  rows: unknown[][];
}

/** One card transaction read from an export. */
export interface ImportedRow {
  /** The transaction date; for installment k it is the purchase date + (k-1) months, clamped. */
  date: ISODate;
  /** > 0 expense, < 0 refund. */
  amount: Agorot;
  merchant: string;
  cardLast4: string | null;
  /** Leumi's category text. */
  categoryHint: string | null;
  installment: { index: number; count: number } | null;
  /** From the "approved, not yet charged" sheet. */
  pending: boolean;
  /** card:<last4>:<date>:<amount>:<merchant>:<installmentIndex|0>#<n>; never includes sheet or status. */
  importKey: string;
}

export interface CardFile {
  cardLast4: string;
  billingMonth: Month;
  rows: ImportedRow[];
  /** Sum of the charged and foreign sheets' totals. */
  chargedTotal: Agorot;
}
