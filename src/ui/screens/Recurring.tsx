import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { deleteRecurring, loadMonth, upsertRecurring, type MonthData } from '../../data/repo';
import { monthOf, todayInIsrael } from '../../engine/dates';
import { toAgorot } from '../../engine/money';
import type { RecurringItem } from '../../engine/types';
import Amount from '../components/Amount';
import ConfirmDialog from '../components/ConfirmDialog';
import { useHousehold } from '../household';
import { useToast } from '../toast';

type Editing = {
  id?: string; kind: RecurringItem['kind']; name: string; amount: string; dayOfMonth: string;
  intervalMonths: number; startMonth: string; paidBy: RecurringItem['paidBy'];
};

const intervals = [1, 2, 3, 6, 12];
const intervalText = (n: number) => (n === 1 ? 'כל חודש' : `כל ${n} חודשים`);

export default function Recurring() {
  const { household } = useHousehold();
  const toast = useToast();
  const month = monthOf(todayInIsrael());
  const [data, setData] = useState<MonthData | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<RecurringItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadMonth(household.id, month).then(setData, () => setError('לא הצלחנו לטעון את הנתונים.'));
  }, [household.id, month]);
  useEffect(reload, [reload]);

  const blank = (kind: RecurringItem['kind']): Editing => ({ kind, name: '', amount: '', dayOfMonth: '1', intervalMonths: 1, startMonth: month, paidBy: 'bank' });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    let amount: number;
    try {
      amount = toAgorot(editing.amount);
    } catch {
      return setError('סכום לא תקין');
    }
    const day = Number(editing.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError('יום בחודש לא תקין');
    try {
      await upsertRecurring(household.id, {
        id: editing.id, kind: editing.kind, name: editing.name.trim(), amount, dayOfMonth: day,
        intervalMonths: editing.intervalMonths, startMonth: editing.startMonth, active: true,
        paidBy: editing.kind === 'income' ? 'bank' : editing.paidBy,
      });
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
      await deleteRecurring(deleting.id);
      toast('נמחק');
      reload();
    } catch {
      setError('המחיקה נכשלה. נסו שוב.');
    }
    setDeleting(null);
  }

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">טוען…</p>;

  const section = (kind: RecurringItem['kind'], title: string, addLabel: string) => (
    <section className="card">
      <h2>{title}</h2>
      {data.recurring.filter((r) => r.kind === kind).length === 0 && <p className="muted">עוד לא הוגדרו</p>}
      {data.recurring
        .filter((r) => r.kind === kind)
        .map((r) => (
          <div key={r.id} className="row">
            <button
              type="button"
              className="link-button"
              onClick={() => setEditing({ id: r.id, kind: r.kind, name: r.name, amount: String(r.amount / 100), dayOfMonth: String(r.dayOfMonth), intervalMonths: r.intervalMonths, startMonth: r.startMonth, paidBy: r.paidBy })}
            >
              {r.name}
              <span className="muted">{` · ${intervalText(r.intervalMonths)}${r.kind === 'fixed' ? ` · ${r.paidBy === 'card' ? 'אשראי' : 'בנק'}` : ''}`}</span>
            </button>
            <span>
              <Amount value={r.amount} />
              <button type="button" className="danger" aria-label={`מחיקת ${r.name}`} onClick={() => setDeleting(r)}>✕</button>
            </span>
          </div>
        ))}
      {!editing && (
        <button type="button" onClick={() => setEditing(blank(kind))}>{addLabel}</button>
      )}
    </section>
  );

  return (
    <>
      <h1>קבועות</h1>
      {section('income', 'הכנסות', '+ הכנסה')}
      {section('fixed', 'הוצאות קבועות', '+ הוצאה קבועה')}
      {editing && (
        <form className="card form" onSubmit={save}>
          <h2>{editing.kind === 'income' ? 'הכנסה' : 'הוצאה קבועה'}</h2>
          <label>
            שם
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
          </label>
          <label>
            סכום
            <input inputMode="decimal" dir="ltr" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} required />
          </label>
          <label>
            יום בחודש
            <input type="number" min={1} max={31} value={editing.dayOfMonth} onChange={(e) => setEditing({ ...editing, dayOfMonth: e.target.value })} />
          </label>
          <label>
            כל כמה חודשים
            <select value={editing.intervalMonths} onChange={(e) => setEditing({ ...editing, intervalMonths: Number(e.target.value) })}>
              {intervals.map((n) => (
                <option key={n} value={n}>{intervalText(n)}</option>
              ))}
            </select>
          </label>
          <label>
            מחודש
            <input type="month" value={editing.startMonth} onChange={(e) => setEditing({ ...editing, startMonth: e.target.value })} required />
          </label>
          {editing.kind === 'fixed' && (
            <label>
              יורד מ
              <select value={editing.paidBy} onChange={(e) => setEditing({ ...editing, paidBy: e.target.value as RecurringItem['paidBy'] })}>
                <option value="bank">בנק</option>
                <option value="card">אשראי</option>
              </select>
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary">שמירה</button>
          <button type="button" onClick={() => setEditing(null)}>ביטול</button>
        </form>
      )}
      {deleting && (
        <ConfirmDialog text={`למחוק את "${deleting.name}"?`} confirmLabel="מחיקה" onConfirm={remove} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
