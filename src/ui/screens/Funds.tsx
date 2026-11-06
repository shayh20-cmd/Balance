import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { deleteFund, loadMonth, upsertFund, type FundDetails, type MonthData } from '../../data/repo';
import { monthOf, todayInIsrael } from '../../engine/dates';
import { toAgorot } from '../../engine/money';
import ConfirmDialog from '../components/ConfirmDialog';
import FundCard from '../components/FundCard';
import { useHousehold } from '../household';
import { useToast } from '../toast';

type Editing = { id?: string; name: string; target: string; targetDate: string; annual: boolean };

export default function Funds() {
  const { household } = useHousehold();
  const toast = useToast();
  const month = monthOf(todayInIsrael());
  const [data, setData] = useState<MonthData | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<FundDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadMonth(household.id, month).then(setData, () => setError('לא הצלחנו לטעון את הנתונים.'));
  }, [household.id, month]);
  useEffect(reload, [reload]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    let target: number;
    try {
      target = toAgorot(editing.target);
    } catch {
      return setError('סכום לא תקין');
    }
    try {
      await upsertFund(household.id, { id: editing.id, name: editing.name.trim(), target, targetDate: editing.targetDate, annual: editing.annual });
      setEditing(null);
      setError(null);
      toast('נשמר');
      reload();
    } catch {
      setError('השמירה נכשלה. נסו שוב.');
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await deleteFund(deleting.id);
      toast('נמחק');
      reload();
    } catch {
      setError('המחיקה נכשלה. נסו שוב.');
    }
    setDeleting(null);
  }

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">טוען…</p>;
  return (
    <>
      <h1>קופות</h1>
      <p className="muted">הוצאות גדולות ידועות מראש. כל קופה מפרישה כל חודש סכום קבוע עד תאריך היעד.</p>
      {data.funds.map((f) => (
        <FundCard
          key={f.id}
          fund={f}
          month={month}
          onEdit={() => setEditing({ id: f.id, name: f.name, target: String(f.target / 100), targetDate: f.targetDate, annual: f.annual })}
          onDelete={() => setDeleting(f)}
        />
      ))}
      {editing ? (
        <form className="card form" onSubmit={save}>
          <label>
            שם
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
          </label>
          <label>
            סכום יעד
            <input inputMode="decimal" dir="ltr" value={editing.target} onChange={(e) => setEditing({ ...editing, target: e.target.value })} required />
          </label>
          <label>
            תאריך יעד
            <input type="date" value={editing.targetDate} onChange={(e) => setEditing({ ...editing, targetDate: e.target.value })} required />
          </label>
          <label className="check">
            <input type="checkbox" checked={editing.annual} onChange={(e) => setEditing({ ...editing, annual: e.target.checked })} />
            חוזרת כל שנה
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary">שמירה</button>
          <button type="button" onClick={() => setEditing(null)}>ביטול</button>
        </form>
      ) : (
        <button type="button" className="primary wide" onClick={() => setEditing({ name: '', target: '', targetDate: '', annual: false })}>
          + קופה חדשה
        </button>
      )}
      {deleting && (
        <ConfirmDialog text={`למחוק את הקופה "${deleting.name}"?`} confirmLabel="מחיקה" onConfirm={remove} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
