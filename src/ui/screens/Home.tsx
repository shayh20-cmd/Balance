import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { monthCloses, reviewCount } from '../../data/importRepo';
import { loadMonth, type BankBalance, type MonthData } from '../../data/repo';
import { addMonths, monthOf, todayInIsrael } from '../../engine/dates';
import { formatShekels } from '../../engine/money';
import { breakdown as breakdownOf, type Breakdown } from '../../engine/breakdown';
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
  /** The current week; null for another month. */
  week: WeekStatus | null;
  /** The month's lines, for the income and expense cards. */
  breakdown?: Breakdown;
  /** Which month is shown, relative to today. */
  current?: 'past' | 'now' | 'future';
  onPrev?: () => void;
  onNext?: () => void;
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

const heroLabel = { past: 'נשאר בסוף החודש', now: 'נשאר לבזבז החודש', future: 'צפוי להוצאות משתנות' };

export function HomeView({
  summary, week, breakdown, current = 'now', onPrev, onNext, recent, bank, householdName, memberCount, closed = null, today,
  toReview = 0, intro = false,
}: HomeViewProps) {
  const overspending = (week?.projectedOverspend ?? 0) > 0;
  const m = summary.month;
  return (
    <div className={intro ? 'home intro' : 'home'}>
      <header className="home-top rise" {...rise(0)}>
        <div className="month-nav">
          <button type="button" aria-label="החודש הקודם" onClick={onPrev}>›</button>
          <h1>{`${monthName(m)} ${m.slice(0, 4)}`}</h1>
          <button type="button" aria-label="החודש הבא" onClick={onNext}>‹</button>
        </div>
        <div className="muted">{`${householdName} · ${memberCount} משתתפים`}</div>
      </header>

      {closed && today && <CloseReminder today={today} closed={closed} />}
      {toReview > 0 && (
        <Link to="/review" className="review-link">{`${toReview} לבדיקה`}</Link>
      )}

      <section className="card hero rise" {...rise(1)}>
        <div className="label">{heroLabel[current]}</div>
        <Amount value={summary.leftToSpend} className="big" animate />
        <div className="sub">{`מתוך ${formatShekels(summary.variableBudget)} להוצאות משתנות`}</div>
        <ProgressBar value={summary.variableSpent} max={summary.variableBudget} tone={summary.leftToSpend < 0 ? 'bad' : 'good'} />
      </section>

      {week && (
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
      )}

      {breakdown && (
        <Link to={`/month/${m}/income`} className="card tile-link rise" {...rise(3)}>
          <div className="split">
            <div className="label">הכנסות</div>
            <Amount value={summary.income} className="mid" />
          </div>
          <ProgressBar value={breakdown.received} max={summary.income} />
          <div className="sub">{`התקבלו ${formatShekels(breakdown.received)}`}</div>
        </Link>
      )}

      {breakdown && (
        <section className="card rise" {...rise(4)}>
          <div className="split">
            <div className="label">הוצאות החודש</div>
            <Amount value={summary.fixed + summary.variableSpent} className="mid" />
          </div>
          <Link to={`/month/${m}/fixed`} className="sub-bar link-row">
            <div className="split">
              <span>קבועות</span>
              <Amount value={summary.fixed} className="small" />
            </div>
            <ProgressBar value={breakdown.paidFixed} max={summary.fixed} />
            <div className="sub">{`שולמו ${formatShekels(breakdown.paidFixed)}`}</div>
          </Link>
          <Link to={`/month/${m}/variable`} className="sub-bar link-row">
            <div className="split">
              <span>משתנות</span>
              <Amount value={summary.variableSpent} className="small" />
            </div>
            <ProgressBar value={summary.variableSpent} max={summary.variableBudget} tone={summary.leftToSpend < 0 ? 'bad' : 'good'} />
            <div className="sub">{`מתוך ${formatShekels(summary.variableBudget)}`}</div>
          </Link>
          {summary.fundProvision > 0 && <div className="sub">{`ועוד הפרשה לקופות: ${formatShekels(summary.fundProvision)}`}</div>}
        </section>
      )}

      <div className={toReview > 0 ? 'pair' : 'pair single'}>
        <section className="card dark rise" {...rise(5)}>
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
          <Link to="/review" className="card tile-link rise" {...rise(6)}>
            <div className="label">לבדיקה</div>
            <div className="mid">{toReview}</div>
            <div className="sub">עסקאות מהייבוא</div>
          </Link>
        )}
      </div>

      <section className="card rise" {...rise(7)}>
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
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const intro = useRef(!introPlayed).current;

  useEffect(() => {
    // Extras: Home works without them.
    monthCloses(household.id).then(setClosed, () => setClosed(null));
    reviewCount(household.id, today).then(setToReview, () => setToReview(0));
  }, [household.id, today]);

  useEffect(() => {
    loadMonth(household.id, month).then(setData, () => setError(true));
  }, [household.id, month]);

  useEffect(() => {
    if (data) introPlayed = true;
  }, [data]);

  if (error) return <p className="error">לא הצלחנו לטעון את הנתונים. נסו לרענן.</p>;
  if (!data || data.month !== month) return <p className="muted">טוען…</p>;
  const current = month === thisMonth ? 'now' : month < thisMonth ? 'past' : 'future';
  return (
    <HomeView
      summary={computeMonth(data)}
      week={current === 'now' ? computeWeek(data, today) : null}
      breakdown={breakdownOf(data)}
      current={current}
      onPrev={() => setMonth(addMonths(month, -1))}
      onNext={() => setMonth(addMonths(month, 1))}
      recent={data.txns.filter((t) => !t.isCardSettlement).slice(0, 5)}
      bank={data.bankBalance}
      householdName={household.name}
      memberCount={data.members.length}
      closed={current === 'now' ? closed : null}
      today={today}
      toReview={current === 'now' ? toReview : 0}
      intro={intro}
    />
  );
}
