import type { ISODate, Month } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

function parse(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function format(dt: Date): ISODate {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function monthOf(d: ISODate): Month {
  return d.slice(0, 7);
}

export function daysInMonth(m: Month): number {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export function monthsBetween(from: Month, to: Month): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = m.split('-').map(Number);
  const total = y * 12 + (mo - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function dayOfWeek(d: ISODate): number {
  return parse(d).getUTCDay();
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = parse(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return format(dt);
}

/** Inclusive count of days from a to b (b >= a gives >= 1). */
export function daysBetweenInclusive(a: ISODate, b: ISODate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000) + 1;
}

export function todayInIsrael(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
}
