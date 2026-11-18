// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLeumiCard } from '../../src/import/leumiCard';
import { readWorkbook } from '../../src/import/sheets';
import type { CardFile, Sheet } from '../../src/import/types';

const fixture = () => {
  const b = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'leumi-card.xlsx'));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

let file: CardFile;
beforeAll(async () => {
  file = parseLeumiCard(await readWorkbook(fixture()));
});

const HEAD = ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות'];
const sheet = (name: string, rows: unknown[][]): Sheet => ({
  name,
  rows: [['x-000000000'], ['1111-לאומי מאסטרקארד'], ['12/2026'], HEAD, ...rows, [], ['סך הכל'], ['0']],
});

test('card, billing month and total', () => {
  expect(file.cardLast4).toBe('1111');
  expect(file.billingMonth).toBe('2026-12');
  expect(file.chargedTotal).toBe(22313);
  expect(file.rows).toHaveLength(7);
});

test('installment row is placed in its own month', () => {
  const r = file.rows.find((x) => x.merchant === 'ליברה ביטוח חובה')!;
  expect(r).toMatchObject({ date: '2026-11-22', amount: 12200, installment: { index: 6, count: 10 }, pending: false });
});

test('pending row uses the original amount', () => {
  const r = file.rows.find((x) => x.merchant === "ג'ינג'ז מרקט קרליבך")!;
  expect(r).toMatchObject({ amount: 4164, pending: true, date: '2026-11-17', cardLast4: '1111', categoryHint: 'מזון וצריכה' });
});

test('refund is negative', () => {
  expect(file.rows.find((x) => x.merchant === 'חנות')!.amount).toBe(-4000);
});

test('foreign rows use the shekel charge', () => {
  expect(file.rows.find((x) => x.merchant.startsWith('GOOGLE CLAUDE'))!).toMatchObject({ amount: 6000, date: '2026-11-05' });
});

test('identical rows get distinct keys', () => {
  const keys = file.rows.filter((x) => x.merchant === 'EXPRESS 7').map((x) => x.importKey);
  expect(keys).toEqual(['card:1111:2026-11-02:1200:EXPRESS 7:0#1', 'card:1111:2026-11-02:1200:EXPRESS 7:0#2']);
});

test('keys ignore pending status', () => {
  const pending = parseLeumiCard([sheet('עסקאות שאושרו וטרם נקלטו', [['17-11-2026', 'ג', 'מזון וצריכה', '1111', 'רגילה', null, null, 41.64, '₪']])]);
  const charged = parseLeumiCard([sheet('עסקאות במועד החיוב', [['17-11-2026', 'ג', 'מזון וצריכה', '1111', 'רגילה', 41.64, '₪', 41.64, '₪', '02-12-2026']])]);
  expect(pending.rows[0].pending).toBe(true);
  expect(charged.rows[0].pending).toBe(false);
  expect(pending.rows[0].importKey).toBe(charged.rows[0].importKey);
});

test('a non-Leumi workbook throws not_leumi_card', () => {
  expect(() => parseLeumiCard([{ name: 'Sheet1', rows: [['a', 'b'], [1, 2]] }])).toThrow('not_leumi_card');
});
