import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { markReviewed, resolveInbox, reviewItems, type InboxItem } from '../../data/importRepo';
import type { Txn } from '../../engine/types';
import Amount from '../components/Amount';
import { shortDate } from '../format';
import { useHousehold } from '../household';

export default function Review() {
  const { household } = useHousehold();
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reviewItems(household.id).then(
      (r) => { setTxns(r.txns); setInbox(r.inbox); },
      () => setError('לא הצלחנו לטעון את הנתונים. נסו לרענן.'),
    );
  }, [household.id]);

  async function ok(id: string) {
    try {
      await markReviewed(id);
      setTxns((ts) => ts?.filter((t) => t.id !== id) ?? null);
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
      {txns.length === 0 && inbox.length === 0 && <p className="muted">אין מה לבדוק</p>}
      {txns.length > 0 && (
        <section className="card">
          <h2>עסקאות שלא היה ברור איך להתאים</h2>
          {txns.map((t) => (
            <div key={t.id} className="row">
              <span>
                {t.merchant} <span className="muted">{shortDate(t.date)}</span>
              </span>
              <Amount value={t.amount} className={t.kind === 'income' ? 'income' : ''} />
              <span className="actions-inline">
                <button type="button" onClick={() => ok(t.id)}>זה בסדר</button>
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
