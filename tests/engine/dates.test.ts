import { addDays, addMonths, dayOfWeek, daysInMonth, monthOf, monthsBetween, todayInIsrael } from '../../src/engine/dates';

test('dayOfWeek: 2026-11-01 is a Sunday', () => {
  expect(dayOfWeek('2026-11-01')).toBe(0);
  expect(dayOfWeek('2026-11-07')).toBe(6);
});
test('daysInMonth including a leap February', () => {
  expect(daysInMonth('2026-11')).toBe(30);
  expect(daysInMonth('2028-02')).toBe(29);
});
test('monthsBetween and addMonths', () => {
  expect(monthsBetween('2026-11', '2027-08')).toBe(9);
  expect(monthsBetween('2026-11', '2026-10')).toBe(-1);
  expect(addMonths('2026-11', 3)).toBe('2027-02');
  expect(addMonths('2026-01', -1)).toBe('2025-12');
});
test('monthOf and addDays across a month end', () => {
  expect(monthOf('2026-11-30')).toBe('2026-11');
  expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
});
test('todayInIsrael uses the Israeli date, not UTC', () => {
  expect(todayInIsrael(new Date('2026-11-06T22:30:00Z'))).toBe('2026-11-07');
});
