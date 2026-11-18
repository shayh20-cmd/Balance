import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadMonth, type MonthData } from '../../data/repo';
import { addMonths, monthOf, todayInIsrael } from '../../engine/dates';
import type { Source } from '../../engine/types';
import Amount from '../components/Amount';
import SourcePill from '../components/SourcePill';
import { monthName, shortDate } from '../format';
import { useHousehold } from '../household';

const sources: { value: Source; label: string }[] = [
  { value: 'manual', label: 'ידני' },
  { value: 'file', label: 'קובץ' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'מייל' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'google_wallet', label: 'Google Wallet' },
];

export default function Transactions() {
  const { household } = useHousehold();
  const [params] = useSearchParams();
  const asked = params.get('m');
  const [month, setMonth] = useState(asked && /^\d{4}-\d{2}$/.test(asked) ? asked : monthOf(todayInIsrael()));
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('');
  const [member, setMember] = useState('');
  const [source, setSource] = useState('');

  useEffect(() => {
    setData(null);
    loadMonth(household.id, month).then(setData, () => setError(true));
  }, [household.id, month]);

  const rows = useMemo(
    () =>
      (data?.txns ?? []).filter(
        (t) => (!category || t.categoryId === category) && (!member || t.memberId === member) && (!source || t.source === source),
      ),
    [data, category, member, source],
  );
  const categoryName = (id: string | null) => data?.categories.find((c) => c.id === id)?.name ?? '';

  return (
    <>
      <div className="month-nav">
        <button type="button" aria-label="החודש הקודם" onClick={() => setMonth(addMonths(month, -1))}>›</button>
        <h1>{`${monthName(month)} ${month.slice(0, 4)}`}</h1>
        <button type="button" aria-label="החודש הבא" onClick={() => setMonth(addMonths(month, 1))}>‹</button>
      </div>
      <Link to={`/close/${month}`} className="review-link">{`סגירת חודש ${monthName(month)}: העלאת קבצים ועריכה`}</Link>
      {data && (
        <div className="filters">
          <select aria-label="קטגוריה" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">כל הקטגוריות</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select aria-label="משתתף" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">כל המשתתפים</option>
            {data.members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.displayName}</option>
            ))}
          </select>
          <select aria-label="מקור" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">כל המקורות</option>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="error">לא הצלחנו לטעון את הנתונים. נסו לרענן.</p>}
      {!data && !error && <p className="muted">טוען…</p>}
      {data && (
        <section className="card">
          {rows.length === 0 && <p className="muted">אין עסקאות להצגה</p>}
          {rows.map((t) => (
            <Link key={t.id} to={`/tx/${t.id}`} className="row link-row">
              <span>
                <span>{t.merchant || categoryName(t.categoryId) || 'ללא תיאור'}</span> <SourcePill source={t.source} />
                <div className="muted">{[shortDate(t.date), categoryName(t.categoryId)].filter(Boolean).join(' · ')}</div>
              </span>
              <Amount value={t.amount} className={t.kind === 'income' ? 'income' : ''} />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
