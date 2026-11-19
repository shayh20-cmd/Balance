export type Agorot = number; // integer number of agorot (1/100 ILS)
export type ISODate = string; // 'YYYY-MM-DD'
export type Month = string; // 'YYYY-MM'
/** card_app: the card company's app notification (Max). */
export type Source = 'manual' | 'file' | 'sms' | 'email' | 'apple_pay' | 'google_wallet' | 'card_app';

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
  /** The bank's own category text, from a file. */
  categoryHint: string | null;
}

/** Fields the app writes when a person adds or edits a transaction; the import fields keep their defaults. */
export type TxnFields = Omit<Txn, 'id' | 'cardLast4' | 'importKey' | 'needsReview' | 'categoryHint'>;

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
  /** Last month it is due in; null = no end (loans, installment purchases end). */
  endMonth: Month | null;
  /** The amount varies (water, electricity): expect the average of recent actuals. */
  variableAmount: boolean;
  /** Set on items made from a card installment purchase; unique per household. */
  installmentKey: string | null;
  /** For a card-paid item: the merchant it is charged under (merchantKey), learned from a confirmed link. */
  merchantKey: string | null;
}

export interface Fund {
  id: string;
  name: string;
  target: Agorot;
  targetDate: ISODate;
  balance: Agorot; // saved before the month being computed
  isGeneral: boolean;
}
