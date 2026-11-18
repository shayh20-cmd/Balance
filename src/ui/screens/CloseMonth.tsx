import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { applyPlan, closeMonth, loadForImport, loadImports, monthCloses, reopenMonth, type ImportCount } from '../../data/importRepo';
import { alreadyUploaded, fileLine, filesForMonth, loadImportFiles, logImport, type ImportFile, type ImportFileEntry } from '../../data/uploads';
import { loadCategoryRules, loadMonth, upsertInstallmentItems, type CategoryRule, type MonthData } from '../../data/repo';
import { addDays } from '../../engine/dates';
import { formatShekels } from '../../engine/money';
import type { ISODate, RecurringItem } from '../../engine/types';
import { installmentDrafts } from '../../import/installments';
import { parseLeumiCard } from '../../import/leumiCard';
import { parseLeumiChecking } from '../../import/leumiChecking';
import { planCardImport, planCheckingImport, type ImportPlan } from '../../import/plan';
import { readWorkbook } from '../../import/sheets';
import type { CardFile } from '../../import/types';
import { monthName, shortDate } from '../format';
import { useHousehold } from '../household';

/**
 * Installment purchases become fixed items before the file is planned. A failure here (a network error, the
 * database not updated yet) is reported on its own line and the import goes on without them.
 */
export async function addInstallmentItems(
  file: CardFile, items: RecurringItem[], upsert: (drafts: Omit<RecurringItem, 'id'>[]) => Promise<number>,
  reload: () => Promise<RecurringItem[]>,
): Promise<{ items: RecurringItem[]; line: string | null }> {
  const drafts = installmentDrafts(file, items);
  if (drafts.length === 0) return { items, line: null };
  try {
    const added = await upsert(drafts);
    return { items: await reload(), line: added ? `נוספו ${added} עסקאות בתשלומים לקבועות` : null };
  } catch {
    return { items, line: 'לא הצלחנו להוסיף את העסקאות בתשלומים לקבועות' };
  }
}

/** Shown on a month already closed: files can still be added and transactions fixed, or the close undone. */
export function ClosedNotice({ month, onReopen }: { month: string; onReopen: () => void }) {
  return (
    <section className="card reminder">
      <div>{`החודש ${monthName(month)} סגור. אפשר עדיין להעלות קבצים ולתקן עסקאות.`}</div>
      <button type="button" onClick={onReopen}>פתיחת החודש מחדש</button>
    </section>
  );
}

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
  const [closed, setClosed] = useState(false);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [counts, setCounts] = useState<ImportCount[]>([]);
  const valid = /^\d{4}-\d{2}$/.test(month);
  // Items change during an upload (installment purchases are added), and files are handled one after another.
  const items = useRef<RecurringItem[]>([]);
  const rules = useRef<CategoryRule[]>([]);

  useEffect(() => {
    if (valid) loadImportFiles(household.id).then(setFiles, () => setFiles([]));
    if (valid) loadImports(household.id, `${month}-01`).then((m) => setCounts(m[month] ?? []), () => setCounts([]));
    if (valid) monthCloses(household.id).then((ms) => setClosed(ms.includes(month)), () => setClosed(false));
    if (valid) loadCategoryRules(household.id).then((r) => { rules.current = r; }, () => {});
    if (valid) loadMonth(household.id, month).then((d) => { items.current = d.recurring; setData(d); }, () => setError('לא הצלחנו לטעון את הנתונים. נסו לרענן.'));
  }, [household.id, month, valid]);

  if (!valid) return <Navigate to="/" replace />;

  async function importOne(f: File, kind: 'card' | 'checking') {
    if (!data) return;
    let plan: ImportPlan;
    let label: string;
    let entry: ImportFileEntry;
    const extra: string[] = [];
    try {
      const sheets = await readWorkbook(f);
      if (kind === 'card') {
        const file = parseLeumiCard(sheets);
        const r = range(file.rows.map((x) => x.date));
        const existing = r ? await loadForImport(household.id, r[0], r[1]) : [];
        const inst = await addInstallmentItems(
          file, items.current, (d) => upsertInstallmentItems(household.id, d), async () => (await loadMonth(household.id, month)).recurring,
        );
        items.current = inst.items;
        if (inst.line) extra.push(inst.line);
        plan = planCardImport(file, existing, data.categories, household.id, userId, items.current, rules.current);
        label = file.cardLast4;
        extra.push(`סה"כ חיוב בקובץ: ${formatShekels(file.chargedTotal)}`);
        entry = {
          fileName: f.name, kind: 'card', cardLast4: file.cardLast4, billingMonth: file.billingMonth || null,
          firstDate: r?.[0] ? addDays(r[0], 1) : null, lastDate: r?.[1] ? addDays(r[1], -1) : null, rowCount: file.rows.length,
          ...plan.summary,
        };
      } else {
        const file = parseLeumiChecking(sheets);
        const r = range(file.rows.map((x) => x.date));
        const existing = r ? await loadForImport(household.id, r[0], r[1]) : [];
        plan = planCheckingImport(file, existing, items.current, household.id, userId);
        label = 'עו"ש';
        entry = {
          fileName: f.name, kind: 'checking', cardLast4: null, billingMonth: null,
          firstDate: r?.[0] ? addDays(r[0], 1) : null, lastDate: r?.[1] ? addDays(r[1], -1) : null, rowCount: file.rows.length,
          ...plan.summary,
        };
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
    const before = alreadyUploaded(files, entry);
    if (before) extra.unshift(`הקובץ הזה כבר הועלה (${fileLine(before)}). שום דבר לא נוסף פעמיים.`);
    try {
      const logged = await logImport(household.id, entry);
      setFiles((fs) => [...fs, logged]);
    } catch {
      /* the import itself is saved; only the history line is missing */
    }
    setReview((n) => n + plan.summary.review);
    setLines((ls) => [...ls, summaryLine(label, plan.summary), ...extra]);
    loadImports(household.id, `${month}-01`).then((m) => setCounts(m[month] ?? []), () => {});
  }

  async function onFiles(files: FileList | null, kind: 'card' | 'checking') {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    for (const f of Array.from(files)) await importOne(f, kind);
    setBusy(false);
  }

  async function onReopen() {
    setBusy(true);
    try {
      await reopenMonth(household.id, month);
      setClosed(false);
    } catch {
      setError('לא הצלחנו לפתוח את החודש מחדש. נסו שוב.');
    }
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
      {closed && <ClosedNotice month={month} onReopen={onReopen} />}
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
      <section className="card">
        <h2>קבצים שהועלו לחודש הזה</h2>
        {filesForMonth(files, month).length === 0 && <p className="muted">עוד לא הועלו קבצים</p>}
        {filesForMonth(files, month).map((x) => (
          <div key={x.id} className="row">{fileLine(x)}</div>
        ))}
        {counts.length > 0 && (
          <p className="muted">{`עסקאות מקבצים בחודש הזה: ${counts.map((c) => (c.label === 'עו"ש' ? `עו"ש ${c.count}` : `כרטיס ${c.label} ${c.count}`)).join(' · ')}`}</p>
        )}
      </section>
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
      <Link to={`/tx?m=${month}`}>לעסקאות של החודש</Link>
      <Link to="/close">לכל החודשים</Link>
      {!closed && <button type="button" disabled={busy} onClick={onClose}>סגירת החודש</button>}
    </div>
  );
}
