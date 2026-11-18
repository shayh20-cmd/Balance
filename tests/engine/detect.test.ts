import { detectRecurring } from '../../src/engine/detect';
import { item, txn } from '../fixtures/engine';

const today = '2026-12-05';
const netflix = (m: string, amount = 5490) => txn({ date: `2026-${m}-03`, amount, merchant: 'NETFLIX.COM  AMSTERDAM', cardLast4: '7712' });

test('a monthly Netflix at 54.90 for 3 months is suggested, with its months as evidence', () => {
  expect(detectRecurring([netflix('09'), netflix('10'), netflix('11')], [], [], today)).toEqual([{
    merchantKey: 'netflixcom amsterdam', merchant: 'NETFLIX.COM  AMSTERDAM', kind: 'fixed', amount: 5490, dayOfMonth: 3,
    paidBy: 'card', months: ['2026-09', '2026-10', '2026-11'],
  }]);
});

test('a supermarket with several visits a month is not suggested', () => {
  const visits = ['09', '10', '11'].flatMap((m) => [
    txn({ date: `2026-${m}-05`, amount: 30000, merchant: 'יוחננוף' }),
    txn({ date: `2026-${m}-20`, amount: 31000, merchant: 'יוחננוף' }),
  ]);
  expect(detectRecurring(visits, [], [], today)).toEqual([]);
});

test('amounts 30% apart are not suggested', () => {
  expect(detectRecurring([netflix('09', 5000), netflix('10', 5000), netflix('11', 6500)], [], [], today)).toEqual([]);
});

test('two months only are not enough', () => {
  expect(detectRecurring([netflix('10'), netflix('11')], [], [], today)).toEqual([]);
});

test('three months with a gap are not enough', () => {
  expect(detectRecurring([netflix('08'), netflix('09'), netflix('11')], [], [], today)).toEqual([]);
});

test('dismissed and existing items are not suggested', () => {
  const three = [netflix('09'), netflix('10'), netflix('11')];
  expect(detectRecurring(three, [], ['netflixcom amsterdam'], today)).toEqual([]);
  expect(detectRecurring(three, [item({ id: 'n', kind: 'fixed', amount: 5490, name: 'NETFLIX.COM AMSTERDAM' })], [], today)).toEqual([]);
});

test('linked transactions and this month are ignored', () => {
  const linked = ['09', '10', '11'].map((m) => txn({ date: `2026-${m}-03`, amount: 5490, merchant: 'NETFLIX', recurringItemId: 'n' }));
  expect(detectRecurring(linked, [], [], today)).toEqual([]);
  expect(detectRecurring([netflix('10'), netflix('11'), txn({ date: '2026-12-03', amount: 5490, merchant: 'NETFLIX.COM  AMSTERDAM' })], [], [], today)).toEqual([]);
});

test('a monthly income (same payer) is suggested as income', () => {
  const pay = (m: string, amount: number) => txn({ date: `2026-${m}-10`, amount, merchant: 'ביטוח לאומי', kind: 'income' });
  expect(detectRecurring([pay('08', 27600), pay('09', 27600), pay('10', 28000)], [], [], today)).toMatchObject([
    { merchantKey: 'ביטוח לאומי', kind: 'income', amount: 27600, dayOfMonth: 10, paidBy: 'bank', months: ['2026-08', '2026-09', '2026-10'] },
  ]);
});
