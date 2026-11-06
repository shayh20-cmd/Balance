import { formatShekels, toAgorot } from '../../src/engine/money';

test('formatShekels: whole shekels with thousands separator', () => {
  expect(formatShekels(684000)).toBe('6,840 ₪');
  expect(formatShekels(0)).toBe('0 ₪');
});
test('formatShekels: two decimals when not whole', () => {
  expect(formatShekels(5850)).toBe('58.50 ₪');
  expect(formatShekels(133334)).toBe('1,333.34 ₪');
});
test('formatShekels: negative', () => {
  expect(formatShekels(-32000)).toBe('-320 ₪');
});
test('toAgorot parses separators and decimals', () => {
  expect(toAgorot('1,200')).toBe(120000);
  expect(toAgorot('12.5')).toBe(1250);
  expect(toAgorot(42)).toBe(4200);
});
test('toAgorot rejects non-numeric input', () => {
  expect(() => toAgorot('abc')).toThrow();
  expect(() => toAgorot('')).toThrow();
});
