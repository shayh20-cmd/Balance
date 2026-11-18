import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { applyPlan, closeMonth, loadForImport } from '../../data/importRepo';
import { loadMonth, type MonthData } from '../../data/repo';
import { addDays } from '../../engine/dates';
import { formatShekels } from '../../engine/money';
import type { ISODate } from '../../engine/types';
import { parseLeumiCard } from '../../import/leumiCard';
import { parseLeumiChecking } from '../../import/leumiChecking';
import { planCardImport, planCheckingImport, type ImportPlan } from '../../import/plan';
import { readWorkbook } from '../../import/sheets';
import { monthName, shortDate } from '../format';
import { useHousehold } from '../household';

export function summaryLine(label: string, s: ImportPlan['summary']): string {
  return `${label}: התאמנו ${s.matched}, נוספו ${s.added}, ${s.review} לבדיקה`;
}

/** The range of transactions a file's rows may match: its dates, one day either side. */
function range(dates: ISODate[]): [ISODate, ISODate] | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return [addDays(sorted[0], -1), addDays(sorted[sorted.length - 1], 1)];
}

export default function CloseMonth() {
  const { month = '' } = useParams();
  const { household, userId } = useHousehold();
  const navigate = useNavigate();
  const [data, setData] = useState<MonthData | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [review, setReview] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{4}-\d{2}$/.test(month);

  useEffect(() => {
    if (valid) loadMonth(household.id, month).then(setData, () => setError('לא הצלחנו לטעון את הנתונים. נסו לרענן.'));
  }, [household.id, month, valid]);

  if (!valid) return <Navigate to="/" replace />;

  async function importOne(f: File, kind: 'card' | 'checking') {
    if (!data) return;
    let plan: ImportPlan;
    let label: string;
    const extra: string[] = [];
    try {
      const sheets = await readWorkbook(f);
      if (kind === 'card') {
        const file = parseLeumiCard(sheets);
        const r = range(file.rows.map((x) => x.date));
        const existing = r ? await loadForImport(household.id, r[0], r[1]) : [];
        plan = planCardImport(file, existing, data.categories, household.id, userId);
        label = file.cardLast4;
        extra.push(`סה"כ חיוב בקובץ: ${formatShekels(file.chargedTotal)}`);
      } else {
        const file = parseLeumiChecking(sheets);
        const r = range(file.rows.map((x) => x.date));
        const existing = r ? await loadForImport(household.id, r[0], r[1]) : [];
        plan = planCheckingImport(file, existing, data.recurring, household.id, userId);
        label = 'עו"ש';
        if (file.balance) extra.push(`יתרה בבנק: ${formatShekels(file.balance.amount)} (${shortDate(file.balance.asOf)})`);
      }
    } catch {
      setError(`${f.name}: הקובץ לא נראה כמו ייצוא של לאומי`);
      return;
    }
    try {
      await applyPlan(household.id, plan);
    } catch {
      setError(`${f.name}: לא הצלחנו לשמור. נסו שוב.`);
      return;
    }
    setReview((n) => n + plan.summary.review);
    setLines((ls) => [...ls, summaryLine(label, plan.summary), ...extra]);
  }

  async function onFiles(files: FileList | null, kind: 'card' | 'checking') {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    for (const f of Array.from(files)) await importOne(f, kind);
    setBusy(false);
  }

  async function onClose() {
    setBusy(true);
    try {
      await closeMonth(household.id, month);
      navigate('/');
    } catch {
      setError('לא הצלחנו לסגור את החודש. נסו שוב.');
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <h1>{`סגירת חודש ${monthName(month)} ${month.slice(0, 4)}`}</h1>
      <p className="muted">
        מורידים מאתר לאומי את קובץ האקסל של תנועות העו"ש ואת פירוט החיובים של כל כרטיס, ומעלים אותם כאן. עסקאות שכבר
        נקלטו מהטלפון לא יוכפלו, ואפשר להעלות את אותו קובץ שוב בלי חשש.
      </p>
      <label>
        דוח עו"ש
        <input type="file" accept=".xlsx" disabled={!data || busy} onChange={(e) => { void onFiles(e.target.files, 'checking'); e.target.value = ''; }} />
      </label>
      <label>
        פירוט כרטיסי אשראי
        <input type="file" accept=".xlsx" multiple disabled={!data || busy} onChange={(e) => { void onFiles(e.target.files, 'card'); e.target.value = ''; }} />
      </label>
      {busy && <p className="muted">מעבד…</p>}
      {error && <p className="error">{error}</p>}
      {lines.length > 0 && (
        <section className="card">
          {lines.map((l, i) => (
            <div key={i} className="row">{l}</div>
          ))}
          {review > 0 && <Link to="/review">{`${review} לבדיקה`}</Link>}
        </section>
      )}
      <button type="button" disabled={busy} onClick={onClose}>סגירת החודש</button>
    </div>
  );
}
