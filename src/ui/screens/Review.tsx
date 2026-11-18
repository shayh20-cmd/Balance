import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSuggestions, markReviewed, resolveInbox, reviewItems, type InboxItem } from '../../data/importRepo';
import { dismissRecurring, learnItemMerchant, unlinkTransaction, upsertRecurring } from '../../data/repo';
import { monthOf, todayInIsrael } from '../../engine/dates';
import type { RecurringSuggestion } from '../../engine/detect';
import { formatShekels } from '../../engine/money';
import type { RecurringItem, Txn } from '../../engine/types';
import Amount from '../components/Amount';
import { monthName, shortDate } from '../format';
import { useHousehold } from '../household';

export default function Review() {
  const { household } = useHousehold();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([]);
  const [items, setItems] = useState<RecurringItem[]>([]);
  const today = todayInIsrael();

  useEffect(() => {
    reviewItems(household.id).then(
      (r) => { setTxns(r.txns); setInbox(r.inbox); setItems(r.items); },
      () => setError('לא הצלחנו לטעון את הנתונים. נסו לרענן.'),
    );
    loadSuggestions(household.id, today).then(setSuggestions, () => setSuggestions([]));
  }, [household.id, today]);

  const drop = (key: string) => setSuggestions((xs) => xs.filter((x) => x.merchantKey !== key));

  async function addItem(s: RecurringSuggestion) {
    try {
      await upsertRecurring(household.id, {
        kind: s.kind, name: s.merchant, amount: s.amount, dayOfMonth: s.dayOfMonth, intervalMonths: 1,
        startMonth: monthOf(today), active: true, paidBy: s.paidBy, endMonth: null, variableAmount: false, installmentKey: null,
        merchantKey: s.paidBy === 'card' ? s.merchantKey : null,
      });
      drop(s.merchantKey);
    } catch {
      setError('לא הצלחנו לשמור. נסו שוב.');
    }
  }

  async function notRecurring(s: RecurringSuggestion) {
    try {
      await dismissRecurring(household.id, s.merchantKey);
      drop(s.merchantKey);
    } catch {
      setError('לא הצלחנו לשמור. נסו שוב.');
    }
  }

  const itemOf = (t: Txn) => items.find((i) => i.id === t.recurringItemId);
  const done = (id: string) => setTxns((ts) => ts?.filter((t) => t.id !== id) ?? null);

  /** Confirming a link to a card item teaches it the merchant, so next month links surely. */
  async function ok(t: Txn) {
    try {
      await markReviewed(t.id);
      const it = itemOf(t);
      if (it?.paidBy === 'card') await learnItemMerchant(it.id, t.merchant);
      done(t.id);
    } catch {
      setError('לא הצלחנו לשמור. נסו שוב.');
    }
  }

  async function notRelated(t: Txn) {
    try {
      await unlinkTransaction(t.id);
      done(t.id);
    } catch {
      setError('לא הצלחנו לשמור. נסו שוב.');
    }
  }

  async function ignore(id: string) {
    try {
      await resolveInbox(id);
      setInbox((xs) => xs.filter((x) => x.id !== id));
    } catch {
      setError('לא הצלחנו לשמור. נסו שוב.');
    }
  }

  if (error && !txns) return <p className="error">{error}</p>;
  if (!txns) return <p className="muted">טוען…</p>;
  return (
    <>
      <h1>לבדיקה</h1>
      {error && <p className="error">{error}</p>}
      {txns.length === 0 && inbox.length === 0 && suggestions.length === 0 && <p className="muted">אין מה לבדוק</p>}
      {suggestions.length > 0 && (
        <section className="card">
          <h2>אולי זה קבוע?</h2>
          {suggestions.map((s) => (
            <div key={s.merchantKey} className="row">
              <span>
                {s.merchant}
                <span className="muted">{` ${formatShekels(s.amount)} · הופיע ב${s.months.map(monthName).join(', ')}`}</span>
              </span>
              <span className="actions-inline">
                <button type="button" onClick={() => addItem(s)}>הוספה כפריט קבוע</button>
                <button type="button" onClick={() => notRecurring(s)}>לא קבוע</button>
              </span>
            </div>
          ))}
        </section>
      )}
      {txns.length > 0 && (
        <section className="card">
          <h2>עסקאות שלא היה ברור איך להתאים</h2>
          {txns.map((t) => (
            <div key={t.id} className="row">
              <span>
                {t.merchant} <span className="muted">{shortDate(t.date)}</span>
                {itemOf(t) && <span className="muted">{` · קושר ל: ${itemOf(t)!.name}`}</span>}
              </span>
              <Amount value={t.amount} className={t.kind === 'income' ? 'income' : ''} />
              <span className="actions-inline">
                <button type="button" onClick={() => ok(t)}>{itemOf(t) ? 'כן, זה שייך' : 'זה בסדר'}</button>
                {itemOf(t) && <button type="button" onClick={() => notRelated(t)}>לא שייך</button>}
                <Link to={`/tx/${t.id}`}>עריכה</Link>
              </span>
            </div>
          ))}
        </section>
      )}
      {inbox.length > 0 && (
        <section className="card">
          <h2>התראות מהטלפון שלא הצלחנו לקרוא</h2>
          {inbox.map((x) => (
            <div key={x.id} className="row">
              <span>
                <b>{x.title}</b> <span className="muted">{x.body}</span>
              </span>
              <span className="actions-inline">
                <Link to="/add">הוספה ידנית</Link>
                <button type="button" onClick={() => ignore(x.id)}>התעלמות</button>
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
