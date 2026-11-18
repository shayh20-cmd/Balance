export type Agorot = number; // integer number of agorot (1/100 ILS)
export type ISODate = string; // 'YYYY-MM-DD'
export type Month = string; // 'YYYY-MM'
export type Source = 'manual' | 'file' | 'sms' | 'email' | 'apple_pay' | 'google_wallet';

export interface Txn {
  id: string;
  date: ISODate;
  amount: Agorot; // expense > 0, refund < 0; income > 0
  kind: 'expense' | 'income';
  merchant: string;
  categoryId: string | null;
  recurringItemId: string | null;
  fundId: string | null;
  isCardSettlement: boolean;
  source: Source;
  memberId: string;
  status: 'pending' | 'confirmed';
  cardLast4: string | null;
  /** Set on rows that came from a file; unique per household. */
  importKey: string | null;
  needsReview: boolean;
}

/** Fields the app writes when a person adds or edits a transaction; the import fields keep their defaults. */
export type TxnFields = Omit<Txn, 'id' | 'cardLast4' | 'importKey' | 'needsReview'>;

export interface RecurringItem {
  id: string;
  kind: 'income' | 'fixed';
  name: string;
  amount: Agorot;
  dayOfMonth: number;
  intervalMonths: number;
  startMonth: Month;
  active: boolean;
  paidBy: 'bank' | 'card';
}

export interface Fund {
  id: string;
  name: string;
  target: Agorot;
  targetDate: ISODate;
  balance: Agorot; // saved before the month being computed
  isGeneral: boolean;
}
