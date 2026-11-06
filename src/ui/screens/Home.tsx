import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadMonth, type BankBalance, type MonthData } from '../../data/repo';
import { monthOf, todayInIsrael } from '../../engine/dates';
import { formatShekels } from '../../engine/money';
import { computeMonth, type MonthSummary } from '../../engine/month';
import type { Txn } from '../../engine/types';
import { computeWeek, type WeekStatus } from '../../engine/week';
import Amount from '../components/Amount';
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
}

export function HomeView({ summary, week, recent, bank, householdName, memberCount }: HomeViewProps) {
  const overspending = week.projectedOverspend > 0;
  return (
    <div className="home">
      <div className="home-top">
        <span>{monthName(summary.month)}</span>
        <span>{`${householdName} · ${memberCount} משתתפים`}</span>
      </div>

      <section className="card hero">
        <div className="muted">נשאר לבזבז החודש</div>
        <Amount value={summary.leftToSpend} className="big" />
        <div className="muted">{`מתוך ${formatShekels(summary.variableBudget)} להוצאות משתנות`}</div>
        <ProgressBar value={summary.variableSpent} max={summary.variableBudget} tone={summary.leftToSpend < 0 ? 'bad' : 'good'} />
      </section>

      <section className="card">
        <h2>{`השבוע (${week.week.index} מתוך ${week.weekCount})`}</h2>
        <div className="row">
          <span>יעד שבועי</span>
          <Amount value={week.target} />
        </div>
        <ProgressBar value={week.spent} max={week.target} tone={overspending || week.remaining < 0 ? 'warn' : 'good'} />
        <div className="muted">{`הוצאתם ${formatShekels(week.spent)} · נשארו ${formatShekels(week.remaining)} עד שבת`}</div>
        {overspending && <div className="warn-text">{`בקצב הנוכחי תחרגו בכ-${formatShekels(week.projectedOverspend)}`}</div>}
      </section>

      <section className="card">
        <h2>אחרונות</h2>
        {recent.length === 0 && <p className="muted">אין עדיין עסקאות החודש</p>}
        {recent.map((t) => (
          <Link key={t.id} to={`/tx/${t.id}`} className="row link-row">
            <span>
              {t.merchant} <SourcePill source={t.source} />
            </span>
            <Amount value={t.amount} className={t.kind === 'income' ? 'income' : ''} />
          </Link>
        ))}
      </section>

      <section className="bank">
        {bank ? `יתרה בבנק: ${formatShekels(bank.amount)} · עודכן ${shortDate(bank.asOf)}` : 'יתרה בבנק: לא הוזנה'}
      </section>

      <Link to="/add" className="fab">
        + הוספה ידנית
      </Link>
    </div>
  );
}

export default function Home() {
  const { household } = useHousehold();
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState(false);
  const today = todayInIsrael();

  useEffect(() => {
    loadMonth(household.id, monthOf(today)).then(setData, () => setError(true));
  }, [household.id, today]);

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
    />
  );
}
