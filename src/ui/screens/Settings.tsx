import { Link } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { createInvite, loadMonth, setBankBalance, type MonthData } from '../../data/repo';
import { supabase } from '../../data/supabase';
import { monthOf, todayInIsrael } from '../../engine/dates';
import { toAgorot } from '../../engine/money';
import DevicesSection from '../components/DevicesSection';
import { useHousehold } from '../household';
import { useToast } from '../toast';

export default function Settings() {
  const { household } = useHousehold();
  const toast = useToast();
  const today = todayInIsrael();
  const [data, setData] = useState<MonthData | null>(null);
  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [bank, setBank] = useState('');
  const [asOf, setAsOf] = useState(today);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMonth(household.id, monthOf(today)).then((d) => {
      setData(d);
      if (d.bankBalance) {
        setBank(String(d.bankBalance.amount / 100));
        setAsOf(d.bankBalance.asOf);
      }
    }, () => setError('לא הצלחנו לטעון את הנתונים.'));
  }, [household.id, today]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    try {
      const token = await createInvite(email.trim());
      setInviteLink(`${location.origin}${location.pathname}#/invite/${token}`);
      setError(null);
    } catch {
      setError('לא הצלחנו ליצור הזמנה.');
    }
  }

  async function saveBank(e: FormEvent) {
    e.preventDefault();
    try {
      await setBankBalance(household.id, toAgorot(bank), asOf);
      setError(null);
      toast('נשמר');
    } catch {
      setError('סכום לא תקין');
    }
  }

  async function copy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast('הקישור הועתק');
    } catch {
      /* the link stays selectable on screen */
    }
  }

  return (
    <>
      <h1>הגדרות</h1>
      <section className="card">
        <h2>סגירות חודש</h2>
        <p className="muted">העלאת קבצים מלאומי לכל חודש, טעינה חוזרת ובדיקה.</p>
        <Link to="/close">לכל החודשים</Link>
      </section>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="card">
        <h2>משתתפים</h2>
        {data?.members.map((m) => (
          <div key={m.userId} className="row">
            <span>{m.displayName}</span>
            <span className="muted">{m.role === 'owner' ? 'בעלים' : 'משתתף'}</span>
          </div>
        ))}
      </section>

      <DevicesSection />

      <form className="card form" onSubmit={invite}>
        <h2>הזמנת משתתף</h2>
        <label>
          אימייל
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button className="primary">יצירת קישור הזמנה</button>
        {inviteLink && (
          <>
            <input readOnly dir="ltr" value={inviteLink} onFocus={(e) => e.target.select()} aria-label="קישור הזמנה" />
            <button type="button" onClick={copy}>העתקה</button>
            <p className="muted">שלחו את הקישור למשתתף. הוא יצטרך להיכנס עם אותה כתובת מייל.</p>
          </>
        )}
      </form>

      <form className="card form" onSubmit={saveBank}>
        <h2>יתרה בבנק</h2>
        <p className="muted">מוצגת בנפרד ולא משפיעה על "נשאר לבזבז".</p>
        <label>
          סכום
          <input inputMode="decimal" dir="ltr" value={bank} onChange={(e) => setBank(e.target.value)} required />
        </label>
        <label>
          נכון לתאריך
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} required />
        </label>
        <button className="primary">שמירה</button>
      </form>

      <button type="button" className="wide" onClick={() => supabase.auth.signOut()}>יציאה</button>
    </>
  );
}
