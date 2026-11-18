// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installmentDrafts } from '../../src/import/installments';
import { parseLeumiCard } from '../../src/import/leumiCard';
import { planCardImport } from '../../src/import/plan';
import { readWorkbook } from '../../src/import/sheets';
import type { CardFile, Sheet } from '../../src/import/types';
import { item } from '../fixtures/engine';

let card: CardFile;
beforeAll(async () => {
  const b = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'leumi-card.xlsx'));
  card = parseLeumiCard(await readWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
});

const HEAD = ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות'];
const fileWith = (notes: string): CardFile => parseLeumiCard([{
  name: 'עסקאות במועד החיוב',
  rows: [['x'], ['1111-כרטיס'], ['01/2027'], HEAD, ['22-06-2026', 'ליברה ביטוח חובה', 'ביטוח', '1111', 'תשלומים', 122, '₪', 1220, '₪', '02-01-2027', notes], [], ['סך הכל'], ['122₪']],
} as Sheet]);

test('an installment row 6 of 10 drafts an item from its own month to 2027-03', () => {
  expect(installmentDrafts(card, [])).toEqual([{
    kind: 'fixed', name: 'ליברה ביטוח חובה (תשלומים)', amount: 12200, dayOfMonth: 22, intervalMonths: 1,
    startMonth: '2026-11', endMonth: '2027-03', active: true, paidBy: 'card', variableAmount: false,
    installmentKey: 'inst:1111:2026-06-22:ליברה ביטוח חובה:10',
  }]);
});

test('no draft when the item already exists', () => {
  const [draft] = installmentDrafts(card, []);
  const existing = item({ id: 'ins', kind: 'fixed', amount: 12200, installmentKey: draft.installmentKey });
  expect(installmentDrafts(fileWith('תשלום 7 מתוך 10'), [existing])).toEqual([]);
  expect(installmentDrafts(fileWith('תשלום 7 מתוך 10'), [])[0].installmentKey).toBe(draft.installmentKey);
});

test('regular rows draft nothing', () => {
  expect(installmentDrafts(fileWith(''), [])).toEqual([]);
});

test('planCardImport links the installment row to its item', () => {
  const [draft] = installmentDrafts(card, []);
  const plan = planCardImport(card, [], [], 'h1', 'u1', [{ ...draft, id: 'ins' }]);
  expect(plan.inserts.find((r) => r.merchant === 'ליברה ביטוח חובה')!).toMatchObject({ recurring_item_id: 'ins', needs_review: false });
});
