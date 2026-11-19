import { useState, type FormEvent } from 'react';
import { formatShekels, toAgorot } from '../../engine/money';
import type { Agorot } from '../../engine/types';
import Amount from './Amount';
import Icon from './Icon';

/**
 * How much the household wants to save this month. It can be changed at any time, up to what income leaves
 * after the fixed expenses (maxSavings); whatever is set comes out of "left to spend".
 */
export default function SavingsCard({ goal, max, onSave }: { goal: Agorot; max: Agorot; onSave?: (amount: Agorot) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cap = Math.max(0, max);

  function open() {
    setText(goal ? String(goal / 100) : '');
    setError(null);
    setEditing(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    let amount: Agorot;
    try {
      amount = text.trim() === '' ? 0 : toAgorot(text);
    } catch {
      return setError('סכום לא תקין');
    }
    if (amount < 0) return setError('סכום לא תקין');
    if (amount > cap) return setError(`אפשר לחסוך עד ${formatShekels(cap)} החודש`);
    onSave?.(amount);
    setEditing(false);
  }

  return (
    <section className="card savings rise">
      <div className="card-head">
        <span className="chip savings"><Icon name="piggy" /></span>
        <span className="label">יעד חיסכון החודש</span>
        {!editing && onSave && (
          <button type="button" className="text-btn" aria-label="עריכת יעד החיסכון" onClick={open}>עריכה</button>
        )}
      </div>
      {!editing ? (
        <>
          {goal > 0 ? <Amount value={goal} className="mid" /> : <div className="mid-text">עוד לא הוגדר</div>}
          <div className="sub">{`אפשר לחסוך עד ${formatShekels(cap)}`}</div>
        </>
      ) : (
        <form className="savings-form" onSubmit={save}>
          <input
            type="range" min={0} max={Math.floor(cap / 100)} step={50} aria-hidden="true" tabIndex={-1}
            value={Math.min(Number(text.replace(/,/g, '')) || 0, Math.floor(cap / 100))}
            onChange={(e) => setText(e.target.value)}
          />
          <label>
            סכום לחיסכון
            <input inputMode="decimal" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="sub">{`עד ${formatShekels(cap)} — מה שנשאר מההכנסות אחרי ההוצאות הקבועות`}</div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions-inline">
            <button type="button" onClick={() => setEditing(false)}>ביטול</button>
            <button className="primary">שמירה</button>
          </div>
        </form>
      )}
    </section>
  );
}
