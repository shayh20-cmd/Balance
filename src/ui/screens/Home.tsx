import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { monthCloses, reviewCount } from '../../data/importRepo';
import { loadMonth, type BankBalance, type MonthData } from '../../data/repo';
import { monthOf, todayInIsrael } from '../../engine/dates';
import { formatShekels } from '../../engine/money';
import { computeMonth, type MonthSummary } from '../../engine/month';
import type { ISODate, Month, Txn } from '../../engine/types';
import { computeWeek, type WeekStatus } from '../../engine/week';
import Amount from '../components/Amount';
import CloseReminder from '../components/CloseReminder';
import ProgressBar from '../components/ProgressBar';
import SourcePill from '../components/SourcePill';
import { monthName, shortDate } from '../format';
import { useHousehold } from '../household';

interface HomeViewProps {
  summary: MonthSummary;
  week: WeekStatus;
  recent: Txn[];
  bank: BankBalance | null;
  householdName: string;
  memberCount: number;
  /** null until loaded; the reminder stays hidden then. */
  closed?: Month[] | null;
  today?: ISODate;
  toReview?: number;
  /** Plays the entrance: cards rise in turn, amounts count up, bars fill. Once per app load. */
  intro?: boolean;
}

/** Stagger index for the entrance animation. */
function rise(i: number) {
  return { style: { '--i': i } as CSSProperties };
}

function initial(merchant: string): string {
  return merchant.trim().charAt(0).toUpperCase() || '·';
}

export function HomeView({ summary, week, recent, bank, householdName, memberCount, closed = null, today, toReview = 0, intro = false }: HomeViewProps) {
  const overspending = week.projectedOverspend > 0;
  return (
    <div className={intro ? 'home intro' : 'home'}>
      <header className="home-top rise" {...rise(0)}>
        <h1>{monthName(summary.month)}</h1>
        <div className="muted">{`${householdName} · ${memberCount} משתתפים`}</div>
      </header>

      {closed && today && <CloseReminder today={today} closed={closed} />}
      {toReview > 0 && (
        <Link to="/review" className="review-link">{`${toReview} לבדיקה`}</Link>
      )}

      <section className="card hero rise" {...rise(1)}>
        <div className="label">נשאר לבזבז החודש</div>
        <Amount value={summary.leftToSpend} className="big" animate />
        <div className="sub">{`מתוך ${formatShekels(summary.variableBudget)} להוצאות משתנות`}</div>
        <ProgressBar value={summary.variableSpent} max={summary.variableBudget} tone={summary.leftToSpend < 0 ? 'bad' : 'good'} />
      </section>

      <section className="card week rise" {...rise(2)}>
        <h2 className="card-title">{`השבוע (${week.week.index} מתוך ${week.weekCount})`}</h2>
        <div className="split">
          <div>
            <div className="label">הוצאתם</div>
            <Amount value={week.spent} className="mid" animate />
          </div>
          <div className="end">
            <div className="label">יעד שבועי</div>
            <Amount value={week.target} className="small" />
          </div>
        </div>
        <ProgressBar value={week.spent} max={week.target} tone={overspending || week.remaining < 0 ? 'warn' : 'good'} />
        <div className="sub">{`נשארו ${formatShekels(week.remaining)} עד שבת`}</div>
        {overspending && <div className="warn-text">{`בקצב הנוכחי תחרגו בכ-${formatShekels(week.projectedOverspend)}`}</div>}
      </section>

      <div className={toReview > 0 ? 'pair' : 'pair single'}>
        <section className="card dark rise" {...rise(3)}>
          <div className="label">יתרה בבנק</div>
          {bank ? (
            <>
              <Amount value={bank.amount} className="mid" animate />
              <div className="sub">{`עודכן ${shortDate(bank.asOf)}`}</div>
            </>
          ) : (
            <div className="mid-text">לא הוזנה</div>
          )}
        </section>
        {toReview > 0 && (
          <Link to="/review" className="card tile-link rise" {...rise(4)}>
            <div className="label">לבדיקה</div>
            <div className="mid">{toReview}</div>
            <div className="sub">עסקאות מהייבוא</div>
          </Link>
        )}
      </div>

      <section className="card rise" {...rise(5)}>
        <h2 className="card-title">אחרונות</h2>
        {recent.length === 0 && <p className="muted">אין עדיין עסקאות החודש</p>}
        {recent.map((t) => (
          <Link key={t.id} to={`/tx/${t.id}`} className="tx link-row">
            <span className="tx-icon" aria-hidden="true">{initial(t.merchant)}</span>
            <span className="tx-name">
              <span>{t.merchant}</span>
              <span className="tx-sub">
                <SourcePill source={t.source} />
                <span>{shortDate(t.date)}</span>
              </span>
            </span>
            <Amount value={t.amount} className={t.kind === 'income' ? 'income' : ''} />
          </Link>
        ))}
      </section>

      <Link to="/add" className="fab">
        + הוספה ידנית
      </Link>
    </div>
  );
}

/** The entrance plays on the first visit to Home in this app load, not on every return. */
let introPlayed = false;

export default function Home() {
  const { household } = useHousehold();
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState<Month[] | null>(null);
  const [toReview, setToReview] = useState(0);
  const today = todayInIsrael();
  const intro = useRef(!introPlayed).current;

  useEffect(() => {
    // Extras: Home works without them.
    monthCloses(household.id).then(setClosed, () => setClosed(null));
    reviewCount(household.id, today).then(setToReview, () => setToReview(0));
  }, [household.id, today]);

  useEffect(() => {
    loadMonth(household.id, monthOf(today)).then(setData, () => setError(true));
  }, [household.id, today]);

  useEffect(() => {
    if (data) introPlayed = true;
  }, [data]);

  if (error) return <p className="error">לא הצלחנו לטעון את הנתונים. נסו לרענן.</p>;
  if (!data) return <p className="muted">טוען…</p>;
  return (
    <HomeView
      summary={computeMonth(data)}
      week={computeWeek(data, today)}
      recent={data.txns.filter((t) => !t.isCardSettlement).slice(0, 5)}
      bank={data.bankBalance}
      householdName={household.name}
      memberCount={data.members.length}
      closed={closed}
      today={today}
      toReview={toReview}
      intro={intro}
    />
  );
}
