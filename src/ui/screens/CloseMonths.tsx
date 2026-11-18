import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadImports, monthCloses, type ImportCount } from '../../data/importRepo';
import { addMonths, monthOf, todayInIsrael } from '../../engine/dates';
import type { Month } from '../../engine/types';
import { monthName } from '../format';
import { useHousehold } from '../household';

const MONTHS_BACK = 6;

const describe = (list: ImportCount[] | undefined) =>
  list?.length
    ? list.map((x) => (x.label === 'עו"ש' ? `עו"ש: ${x.count}` : `כרטיס ${x.label}: ${x.count}`)).join(' · ')
    : 'עוד לא נטענו קבצים';

/** Every recent month, open or closed, with the files already loaded into it. */
export function MonthsList({ months, closed, imports }: { months: Month[]; closed: Month[]; imports: Record<Month, ImportCount[]> }) {
  return (
    <section className="card">
      {months.map((m) => (
        <Link key={m} to={`/close/${m}`} className="row link-row">
          <span>{`${monthName(m)} ${m.slice(0, 4)}`}</span>
          <span className="muted">{`${closed.includes(m) ? 'סגור' : 'פתוח'} · ${describe(imports[m])}`}</span>
        </Link>
      ))}
    </section>
  );
}

export default function CloseMonths() {
  const { household } = useHousehold();
  const current = monthOf(todayInIsrael());
  const months = Array.from({ length: MONTHS_BACK + 1 }, (_, i) => addMonths(current, -i));
  const [closed, setClosed] = useState<Month[]>([]);
  const [imports, setImports] = useState<Record<Month, ImportCount[]> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    monthCloses(household.id).then(setClosed, () => setClosed([]));
    loadImports(household.id, `${addMonths(current, -MONTHS_BACK)}-01`).then(setImports, () => setError(true));
  }, [household.id, current]);

  return (
    <>
      <h1>סגירות חודש</h1>
      <p className="muted">
        בוחרים חודש כדי להעלות קבצים שחסרים או לטעון שוב קובץ ולבדוק אותו. העלאה חוזרת של אותו קובץ לא מכפילה עסקאות.
        המספרים הם כמה עסקאות נטענו מכל קובץ.
      </p>
      {error && <p className="error">לא הצלחנו לטעון את הנתונים. נסו לרענן.</p>}
      {!imports && !error && <p className="muted">טוען…</p>}
      {imports && <MonthsList months={months} closed={closed} imports={imports} />}
    </>
  );
}
