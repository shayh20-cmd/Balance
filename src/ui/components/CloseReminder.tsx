import { Link } from 'react-router-dom';
import { addMonths, monthOf } from '../../engine/dates';
import type { ISODate, Month } from '../../engine/types';
import { monthName } from '../format';

/** Last month, from the 3rd of this month on, until it is closed. null when nothing is due. */
export function reminderMonth(today: ISODate, closed: Month[]): Month | null {
  if (Number(today.slice(8, 10)) < 3) return null;
  const last = addMonths(monthOf(today), -1);
  return closed.includes(last) ? null : last;
}

export default function CloseReminder({ today, closed }: { today: ISODate; closed: Month[] }) {
  const month = reminderMonth(today, closed);
  if (!month) return null;
  return (
    <section className="card reminder">
      <div>{`סגירת חודש ${monthName(month)}: העלו את הדוחות מלאומי`}</div>
      <Link to={`/close/${month}`}>לסגירת החודש</Link>
    </section>
  );
}
