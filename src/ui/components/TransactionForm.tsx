import { useState, type FormEvent } from 'react';
import type { Category, TxnDraft } from '../../data/repo';
import { formatShekels, toAgorot } from '../../engine/money';
import type { Fund, ISODate, RecurringItem, Txn } from '../../engine/types';

export type FormDraft = Omit<TxnDraft, 'memberId'>;

interface Props {
  categories: Category[];
  recurring: RecurringItem[];
  funds: Fund[];
  today: ISODate;
  initial?: Txn & { note?: string | null };
  onSubmit: (draft: FormDraft, installments: number) => void;
  onDelete?: () => void;
  /** Where the category came from (a learned rule, the bank's category), shown under it. */
  categoryOrigin?: string | null;
}

/** The link select encodes "rec:<id>" for a recurring item and "fund:<id>" for a fund. */
function linkOf(t?: Txn): string {
  if (t?.recurringItemId) return `rec:${t.recurringItemId}`;
  if (t?.fundId) return `fund:${t.fundId}`;
  return '';
}

export default function TransactionForm({ categories, recurring, funds, today, initial, onSubmit, onDelete, categoryOrigin }: Props) {
  const [kind, setKind] = useState<Txn['kind']>(initial?.kind ?? 'expense');
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount) / 100) : '');
  const [refund, setRefund] = useState(initial ? initial.amount < 0 : false);
  const [date, setDate] = useState(initial?.date ?? today);
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [link, setLink] = useState(linkOf(initial));
  const [installments, setInstallments] = useState('1');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const items = recurring.filter((r) => r.kind === (kind === 'income' ? 'income' : 'fixed'));

  function chooseKind(k: Txn['kind']) {
    setKind(k);
    setLink('');
    setRefund(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    let agorot: number;
    try {
      agorot = toAgorot(amount);
    } catch {
      return setError('סכום לא תקין');
    }
    const count = kind === 'expense' ? Number(installments) : 1;
    if (agorot <= 0 || !Number.isInteger(count) || count < 1 || count > 36) return setError(agorot <= 0 ? 'סכום לא תקין' : 'מספר תשלומים לא תקין');
    setError(null);
    onSubmit(
      {
        kind,
        amount: refund ? -agorot : agorot,
        date,
        merchant: merchant.trim(),
        categoryId: categoryId || null,
        recurringItemId: link.startsWith('rec:') ? link.slice(4) : null,
        fundId: link.startsWith('fund:') ? link.slice(5) : null,
        isCardSettlement: false,
        source: initial?.source ?? 'manual',
        note: note.trim() || null,
      },
      count,
    );
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="segmented">
        <button type="button" aria-pressed={kind === 'expense'} onClick={() => chooseKind('expense')}>הוצאה</button>
        <button type="button" aria-pressed={kind === 'income'} onClick={() => chooseKind('income')}>הכנסה</button>
      </div>
      <label>
        סכום
        <input inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {kind === 'expense' && (
        <label className="check">
          <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
          זיכוי / החזר
        </label>
      )}
      <label>
        תאריך
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        בית עסק / תיאור
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </label>
      <label>
        קטגוריה
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">ללא</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {categoryOrigin && <span className="muted">{categoryOrigin}</span>}
      </label>
      <label>
        שיוך
        <select value={link} onChange={(e) => setLink(e.target.value)}>
          <option value="">{kind === 'income' ? 'הכנסה נוספת' : 'הוצאה משתנה'}</option>
          {items.map((r) => (
            <option key={r.id} value={`rec:${r.id}`}>{r.name}</option>
          ))}
          {kind === 'expense' &&
            funds.map((f) => (
              <option key={f.id} value={`fund:${f.id}`}>{`קופה: ${f.name}`}</option>
            ))}
        </select>
      </label>
      {kind === 'expense' && !initial && (
        <label>
          מספר תשלומים
          <input type="number" min={1} max={36} value={installments} onChange={(e) => setInstallments(e.target.value)} />
        </label>
      )}
      {kind === 'expense' && !initial && Number(installments) > 1 && amount && (
        <p className="muted">
          {(() => {
            try {
              return `${installments} תשלומים של כ-${formatShekels(Math.floor(toAgorot(amount) / Number(installments)))}`;
            } catch {
              return '';
            }
          })()}
        </p>
      )}
      <label>
        הערה
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary">שמירה</button>
      {onDelete && (
        <button type="button" className="danger" onClick={onDelete}>מחיקה</button>
      )}
    </form>
  );
}
