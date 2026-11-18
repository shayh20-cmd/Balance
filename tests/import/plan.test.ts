// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Txn } from '../../src/engine/types';
import { parseLeumiCard } from '../../src/import/leumiCard';
import { parseLeumiChecking } from '../../src/import/leumiChecking';
import { planCardImport, planCheckingImport, type ImportPlan } from '../../src/import/plan';
import { readWorkbook } from '../../src/import/sheets';
import type { CardFile, Sheet } from '../../src/import/types';
import { item, txn } from '../fixtures/engine';

const read = async (name: string) => {
  const b = readFileSync(join(process.cwd(), 'tests', 'fixtures', name));
  return readWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
};
const categories = [
  { id: 'c-super', name: 'סופר' }, { id: 'c-out', name: 'אוכל בחוץ' }, { id: 'c-home', name: 'בית' },
  { id: 'c-fun', name: 'פנאי' }, { id: 'c-other', name: 'אחר' },
];

/** Applies a plan to an in-memory list, the way applyPlan does to the database. */
function apply(existing: Txn[], plan: ImportPlan): Txn[] {
  const out = existing.map((t) => {
    const u = plan.updates.find((x) => x.id === t.id);
    if (!u) return t;
    const p = u.patch;
    return {
      ...t,
      date: p.date ?? t.date, amount: p.amount_agorot ?? t.amount, merchant: p.merchant ?? t.merchant,
      status: p.status ?? t.status, importKey: p.import_key ?? t.importKey, cardLast4: p.card_last4 ?? t.cardLast4,
      categoryId: p.category_id ?? t.categoryId,
    };
  });
  for (const r of plan.inserts) {
    out.push(txn({
      date: r.date, amount: r.amount_agorot, merchant: r.merchant, status: r.status, importKey: r.import_key,
      cardLast4: r.card_last4, source: r.source, categoryId: r.category_id, needsReview: r.needs_review,
    }));
  }
  return out;
}

let card: CardFile;
beforeAll(async () => {
  card = parseLeumiCard(await read('leumi-card.xlsx'));
});

test('card import on the fixture with one Google Pay txn: 1 matched, 6 added, 0 review', () => {
  const gp = txn({ date: '2026-11-17', amount: 4164, merchant: 'GINGIN MARKET', source: 'google_wallet', status: 'pending', cardLast4: '1111' });
  const plan = planCardImport(card, [gp], categories, 'h1', 'u1');
  expect(plan.summary).toEqual({ matched: 1, added: 6, review: 0, skipped: 0 });
  expect(plan.updates).toEqual([{
    id: gp.id,
    patch: {
      date: '2026-11-17', amount_agorot: 4164, merchant: "ג'ינג'ז מרקט קרליבך", status: 'pending', card_last4: '1111',
      import_key: "card:1111:2026-11-17:4164:ג'ינג'ז מרקט קרליבך:0#1", category_name_hint: 'מזון וצריכה', category_id: 'c-super',
    },
  }]);
  const ins = plan.inserts.find((r) => r.merchant === 'ליברה ביטוח חובה')!;
  expect(ins).toMatchObject({
    household_id: 'h1', member_id: 'u1', date: '2026-11-22', amount_agorot: 12200, kind: 'expense', source: 'file',
    status: 'confirmed', category_id: 'c-home', installment_index: 6, installment_count: 10, needs_review: false,
    is_card_settlement: false,
  });
  expect(plan.inserts.find((r) => r.merchant === 'חנות')!).toMatchObject({ amount_agorot: -4000, kind: 'expense', category_id: 'c-other' });
  expect(plan.bankBalance).toBeNull();
});

test('the matched txn keeps the user\'s category', () => {
  const gp = txn({ date: '2026-11-17', amount: 4164, categoryId: 'c-fun', cardLast4: '1111' });
  const plan = planCardImport(card, [gp], categories, 'h1', 'u1');
  expect(plan.updates[0].patch).not.toHaveProperty('category_id');
});

test('a category the household renamed resolves to null', () => {
  const plan = planCardImport(card, [], categories.filter((c) => c.name !== 'בית'), 'h1', 'u1');
  expect(plan.inserts.find((r) => r.merchant === 'ליברה ביטוח חובה')!.category_id).toBeNull();
});

test('an uncertain match merges into a captured txn and flags it, instead of inserting a copy', () => {
  const a = txn({ date: '2026-11-01', amount: 5713 });
  const b = txn({ date: '2026-11-01', amount: 5713 });
  const plan = planCardImport(card, [a, b], categories, 'h1', 'u1');
  expect(plan.summary).toMatchObject({ matched: 1, added: 6, review: 1 });
  expect(plan.inserts.find((r) => r.merchant === 'שומשום קונקורד')).toBeUndefined();
  expect(plan.updates.find((u) => u.id === a.id)!.patch).toMatchObject({ needs_review: true, merchant: 'שומשום קונקורד' });
});

test('card rows link to card-paid fixed items', () => {
  const insurance = item({ id: 'ins', kind: 'fixed', amount: 12200, dayOfMonth: 22, paidBy: 'card' });
  const plan = planCardImport(card, [], categories, 'h1', 'u1', [insurance]);
  expect(plan.inserts.find((r) => r.merchant === 'ליברה ביטוח חובה')!.recurring_item_id).toBe('ins');
  expect(plan.inserts.find((r) => r.merchant === 'שומשום קונקורד')!.recurring_item_id).toBeNull();
});

test('a pending captured txn on this card that the file does not have is flagged', () => {
  const lost = txn({ date: '2026-11-04', amount: 99900, cardLast4: '1111', status: 'pending', source: 'google_wallet' });
  const otherCard = txn({ date: '2026-11-04', amount: 99900, cardLast4: '2222', status: 'pending', source: 'google_wallet' });
  const plan = planCardImport(card, [lost, otherCard], categories, 'h1', 'u1');
  expect(plan.updates).toContainEqual({ id: lost.id, patch: { needs_review: true } });
  expect(plan.updates.find((u) => u.id === otherCard.id)).toBeUndefined();
  expect(plan.summary.review).toBe(1);
});

const HEAD = ['תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב', 'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי'];
const one = (name: string, r: unknown[]): Sheet[] => [{ name, rows: [['x'], ['1111-כרטיס'], ['12/2026'], HEAD, r, [], ['סך הכל'], ['0']] }];

test('planCardImport is idempotent across pending→charged', () => {
  const pending = parseLeumiCard(one('עסקאות שאושרו וטרם נקלטו', ['17-11-2026', 'ג', 'מזון וצריכה', '1111', 'רגילה', null, null, 41.64, '₪']));
  const charged = parseLeumiCard(one('עסקאות במועד החיוב', ['17-11-2026', 'ג', 'מזון וצריכה', '1111', 'רגילה', 41.64, '₪', 41.64, '₪']));
  const first = planCardImport(pending, [], categories, 'h1', 'u1');
  const db = apply([], first);
  expect(db).toHaveLength(1);
  const second = planCardImport(charged, db, categories, 'h1', 'u1');
  expect(second.inserts).toEqual([]);
  expect(second.updates).toEqual([{ id: db[0].id, patch: { status: 'confirmed' } }]);
  const third = planCardImport(charged, apply(db, second), categories, 'h1', 'u1');
  expect(third).toMatchObject({ updates: [], inserts: [], summary: { matched: 0, added: 0, review: 0, skipped: 1 } });
});

test('re-uploading the same card file adds nothing', () => {
  const db = apply([], planCardImport(card, [], categories, 'h1', 'u1'));
  const again = planCardImport(card, db, categories, 'h1', 'u1');
  expect(again).toMatchObject({ updates: [], inserts: [], summary: { added: 0, skipped: 7 } });
});

test('checking import: card settlements are inserted flagged, fixed items linked, balance taken from the newest row', async () => {
  const file = parseLeumiChecking(await read('leumi-checking.xlsx'));
  const items = [
    item({ id: 'salary', kind: 'income', amount: 2070000, dayOfMonth: 2 }),
    item({ id: 'rent', kind: 'fixed', amount: 840000, dayOfMonth: 3 }),
  ];
  const plan = planCheckingImport(file, [], items, 'h1', 'u1');
  expect(plan.updates).toEqual([]);
  expect(plan.inserts).toHaveLength(7);
  expect(plan.bankBalance).toEqual({ amount: 1400000, asOf: '2026-11-10' });
  const by = (m: string) => plan.inserts.find((r) => r.merchant === m)!;
  expect(by('לאומי מאסטרקרד')).toMatchObject({ is_card_settlement: true, kind: 'expense', amount_agorot: 1212319, source: 'file' });
  expect(by('משכורת-חברה בע"מ')).toMatchObject({ kind: 'income', recurring_item_id: 'salary', amount_agorot: 2230400 });
  expect(by('שיק')).toMatchObject({ recurring_item_id: 'rent', is_card_settlement: false });
  expect(by('עמלת פעולה').recurring_item_id).toBeNull();
  expect(plan.summary).toEqual({ matched: 2, added: 7, review: 0, skipped: 0 });

  const again = planCheckingImport(file, apply([], plan), items, 'h1', 'u1');
  expect(again.inserts).toEqual([]);
  expect(again.summary.skipped).toBe(7);
});

test('checking row matches a hand-entered txn instead of adding a copy', async () => {
  const file = parseLeumiChecking(await read('leumi-checking.xlsx'));
  const fee = txn({ date: '2026-11-01', amount: 1000, merchant: 'עמלה' });
  const plan = planCheckingImport(file, [fee], [], 'h1', 'u1');
  expect(plan.inserts.find((r) => r.merchant === 'עמלת פעולה')).toBeUndefined();
  expect(plan.updates).toEqual([{ id: fee.id, patch: { date: '2026-11-01', status: 'confirmed', import_key: 'bank:2026-11-01:expense:1000:עמלת פעולה#1' } }]);
  expect(plan.summary).toMatchObject({ matched: 1, added: 6 });
});

test('salary 25% above expected still links, for review', async () => {
  const file = parseLeumiChecking(await read('leumi-checking.xlsx'));
  const salary = item({ id: 'salary', kind: 'income', amount: 1780000, dayOfMonth: 2 });
  const ins = planCheckingImport(file, [], [salary], 'h1', 'u1').inserts.find((r) => r.kind === 'income' && r.amount_agorot === 2230400)!;
  expect(ins).toMatchObject({ recurring_item_id: 'salary', needs_review: true });
});

test('a salary paid on the 30th links to the next month item, for review', () => {
  const salary = item({ id: 'salary', kind: 'income', amount: 2070000, dayOfMonth: 1, startMonth: '2026-11' });
  const file = { balance: null, rows: [{ date: '2026-10-30', description: 'משכורת', amount: 2070000, kind: 'income' as const, isCardSettlement: false, importKey: 's#1' }] };
  const plan = planCheckingImport(file, [], [salary], 'h1', 'u1');
  expect(plan.inserts[0]).toMatchObject({ recurring_item_id: 'salary', needs_review: true });
});

test('a card-paid item never links to a bank row', () => {
  const netflix = item({ id: 'nf', kind: 'fixed', amount: 1000, dayOfMonth: 1, paidBy: 'card' });
  const file = { balance: null, rows: [{ date: '2026-11-01', description: 'עמלה', amount: 1000, kind: 'expense' as const, isCardSettlement: false, importKey: 'f#1' }] };
  expect(planCheckingImport(file, [], [netflix], 'h1', 'u1').inserts[0].recurring_item_id).toBeNull();
});

test('a row for an item already paid this month is linked but sent to review', async () => {
  const file = parseLeumiChecking(await read('leumi-checking.xlsx'));
  const rent = item({ id: 'rent', kind: 'fixed', amount: 840000, dayOfMonth: 3 });
  const manual = txn({ date: '2026-11-03', amount: 800000, recurringItemId: 'rent' });
  const plan = planCheckingImport(file, [manual], [rent], 'h1', 'u1');
  expect(plan.inserts.find((r) => r.merchant === 'שיק')!).toMatchObject({ recurring_item_id: 'rent', needs_review: true });
  expect(plan.summary).toMatchObject({ matched: 0, review: 1 });
});
