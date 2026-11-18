import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { loadMonth, type Category, type MonthData } from '../../data/repo';
import { breakdown, type Breakdown, type Line } from '../../engine/breakdown';
import { formatShekels } from '../../engine/money';
import type { Month } from '../../engine/types';
import Amount from '../components/Amount';
import { monthName, shortDate } from '../format';
import { useHousehold } from '../household';

type Kind = 'income' | 'fixed' | 'variable';
const titles: Record<Kind, string> = { income: 'הכנסות', fixed: 'הוצאות קבועות', variable: 'הוצאות משתנות' };

function LineRow({ line, kind }: { line: Line; kind: 'income' | 'fixed' }) {
  const done = kind === 'income' ? 'התקבל' : 'שולם';
  const notYet = kind === 'income' ? 'עוד לא התקבל' : 'עוד לא שולם';
  return (
    <div className="detail-line">
      <span>{line.name}</span>
      <span className="amounts">
        <Amount value={line.actual ?? line.expected} className={line.actual === null ? 'muted' : ''} />
        <span className="muted">
          {line.actual === null
            ? `צפוי ${formatShekels(line.expected)} · ${notYet}`
            : `${done} ${formatShekels(line.actual)}${line.expected ? ` · צפוי ${formatShekels(line.expected)}` : ''}`}
        </span>
      </span>
    </div>
  );
}

/** Income, fixed or variable spending of one month, line by line. */
export function DetailView({ kind, month, b, categories }: { kind: Kind; month: Month; b: Breakdown; categories: Category[] }) {
  const title = `${titles[kind]} · ${monthName(month)} ${month.slice(0, 4)}`;
  if (kind !== 'variable') {
    const lines = kind === 'income' ? b.income : b.fixed;
    const total = lines.reduce((a, l) => a + (l.actual ?? l.expected), 0);
    return (
      <>
        <h1>{title}</h1>
        <section className="card">
          <div className="split">
            <span className="label">סה"כ</span>
            <Amount value={total} className="mid" />
          </div>
          {lines.length === 0 && <p className="muted">אין פריטים החודש</p>}
          {lines.map((l) => <LineRow key={l.id} line={l} kind={kind} />)}
        </section>
        <Link to="/recurring">לעריכת הקבועות</Link>
      </>
    );
  }
  const byCategory = new Map<string, number>();
  for (const t of b.variable) byCategory.set(t.categoryId ?? '', (byCategory.get(t.categoryId ?? '') ?? 0) + t.amount);
  const cats = [...byCategory].sort((a, z) => z[1] - a[1]);
  const total = b.variable.reduce((a, t) => a + t.amount, 0);
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? 'ללא קטגוריה';
  return (
    <>
      <h1>{title}</h1>
      <section className="card">
        <div className="split">
          <span className="label">סה"כ</span>
          <Amount value={total} className="mid" />
        </div>
        {cats.map(([id, amount]) => (
          <div key={id} className="detail-line" data-testid="category">
            <span>{name(id)}</span>
            <Amount value={amount} />
          </div>
        ))}
      </section>
      <section className="card">
        {b.variable.length === 0 && <p className="muted">אין הוצאות משתנות החודש</p>}
        {b.variable.map((t) => (
          <Link key={t.id} to={`/tx/${t.id}`} className="detail-line link-row">
            <span>
              {t.merchant} <span className="muted">{shortDate(t.date)}</span>
            </span>
            <Amount value={t.amount} />
          </Link>
        ))}
      </section>
    </>
  );
}

export default function MonthDetail() {
  const { month = '', kind = '' } = useParams();
  const { household } = useHousehold();
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  const valid = /^\d{4}-\d{2}$/.test(month) && (kind === 'income' || kind === 'fixed' || kind === 'variable');

  useEffect(() => {
    if (valid) loadMonth(household.id, month).then(setData, () => setError(true));
  }, [household.id, month, valid]);

  if (!valid) return <Navigate to="/" replace />;
  if (error) return <p className="error">לא הצלחנו לטעון את הנתונים. נסו לרענן.</p>;
  if (!data) return <p className="muted">טוען…</p>;
  return <DetailView kind={kind as Kind} month={month} b={breakdown(data)} categories={data.categories} />;
}
