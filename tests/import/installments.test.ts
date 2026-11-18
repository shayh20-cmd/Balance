// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installmentDrafts } from '../../src/import/installments';
import { parseLeumiCard } from '../../src/import/leumiCard';
import { planCardImport } from '../../src/import/plan';
import { readWorkbook } from '../../src/import/sheets';
import type { CardFile, Sheet } from '../../src/import/types';
import { item, txn } from '../fixtures/engine';

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
    installmentKey: 'inst:1111:2026-06-22:ליברה ביטוח חובה:10:122000',
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

test('an already-imported installment row links to its new item', () => {
  const row = card.rows.find((r) => r.merchant === 'ליברה ביטוח חובה')!;
  const imported = txn({ date: row.date, amount: row.amount, importKey: row.importKey, source: 'file', cardLast4: '1111' });
  const [draft] = installmentDrafts(card, []);
  const plan = planCardImport(card, [imported], [], 'h1', 'u1', [{ ...draft, id: 'ins' }]);
  expect(plan.updates).toContainEqual({ id: imported.id, patch: { recurring_item_id: 'ins' } });
});

test('two same-day purchases at one merchant with different totals get two items', () => {
  const two = parseLeumiCard([{
    name: 'עסקאות במועד החיוב',
    rows: [['x'], ['1111-כרטיס'], ['12/2026'], HEAD,
      ['22-06-2026', 'ליברה', 'ביטוח', '1111', 'תשלומים', 122, '₪', 1220, '₪', '02-12-2026', 'תשלום 6 מתוך 10'],
      ['22-06-2026', 'ליברה', 'ביטוח', '1111', 'תשלומים', 280, '₪', 2800, '₪', '02-12-2026', 'תשלום 6 מתוך 10'],
      [], ['סך הכל'], ['402₪']],
  } as Sheet]);
  const drafts = installmentDrafts(two, []);
  expect(drafts.map((d) => d.amount)).toEqual([12200, 28000]);
  expect(new Set(drafts.map((d) => d.installmentKey)).size).toBe(2);
});

test('an item drafted from installment 1 expects the regular installment, not the rounded first one', () => {
  const first = parseLeumiCard([{
    name: 'עסקאות במועד החיוב',
    rows: [['x'], ['1111-כרטיס'], ['12/2026'], HEAD,
      ['10-11-2026', 'מקרר', 'מוצרי חשמל', '1111', 'תשלומים', 34, '₪', 100, '₪', '02-12-2026', 'תשלום 1 מתוך 3'],
      [], ['סך הכל'], ['34₪']],
  } as Sheet]);
  expect(installmentDrafts(first, [])[0].amount).toBe(3300);
});
