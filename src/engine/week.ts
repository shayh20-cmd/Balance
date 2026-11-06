import { addDays, dayOfWeek, daysBetweenInclusive, daysInMonth, monthOf } from './dates';
import { computeMonth, isVariable, type MonthInput } from './month';
import type { Agorot, ISODate, Month } from './types';

export interface WeekRange {
  start: ISODate;
  end: ISODate;
  days: number;
  index: number; // from 1
}

export interface WeekStatus {
  week: WeekRange;
  weekCount: number;
  target: Agorot;
  spent: Agorot;
  remaining: Agorot;
  projectedOverspend: Agorot;
}

export function weeksOfMonth(m: Month): WeekRange[] {
  const last = `${m}-${String(daysInMonth(m)).padStart(2, '0')}`;
  const weeks: WeekRange[] = [];
  let start = `${m}-01`;
  while (start <= last) {
    const toSaturday = 6 - dayOfWeek(start);
    const end = addDays(start, toSaturday) > last ? last : addDays(start, toSaturday);
    weeks.push({ start, end, days: daysBetweenInclusive(start, end), index: weeks.length + 1 });
    start = addDays(end, 1);
  }
  return weeks;
}

export function computeWeek(input: MonthInput, today: ISODate): WeekStatus {
  if (monthOf(today) !== input.month) throw new Error(`today ${today} is not in ${input.month}`);
  const weeks = weeksOfMonth(input.month);
  const week = weeks.find((w) => w.start <= today && today <= w.end)!;
  const monthEnd = weeks[weeks.length - 1].end;
  const { variableBudget } = computeMonth(input);
  const variable = input.txns.filter((t) => monthOf(t.date) === input.month && isVariable(t));
  const before = variable.filter((t) => t.date < week.start).reduce((a, t) => a + t.amount, 0);
  const spent = variable.filter((t) => t.date >= week.start && t.date <= week.end).reduce((a, t) => a + t.amount, 0);
  const leftAtStart = variableBudget - before;
  const target = Math.max(0, Math.floor((leftAtStart / daysBetweenInclusive(week.start, monthEnd)) * week.days));
  const daysElapsed = Math.max(1, daysBetweenInclusive(week.start, today));
  const projected = Math.floor((spent / daysElapsed) * week.days);
  return { week, weekCount: weeks.length, target, spent, remaining: target - spent, projectedOverspend: Math.max(0, projected - target) };
}
