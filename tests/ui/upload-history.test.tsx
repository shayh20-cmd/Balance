import { alreadyUploaded, fileLine, filesForMonth, type ImportFile } from '../../src/data/uploads';

const card: ImportFile = {
  id: 'f1', uploadedAt: '2026-11-18T08:30:00Z', fileName: 'transaction-details_export.xlsx', kind: 'card', cardLast4: '7712',
  billingMonth: '2026-11', firstDate: '2026-10-01', lastDate: '2026-10-31', rowCount: 82, matched: 0, added: 82, review: 0,
};
const bank: ImportFile = {
  ...card, id: 'f2', kind: 'checking', cardLast4: null, billingMonth: null, firstDate: '2026-09-01', lastDate: '2026-11-10', rowCount: 44,
};

test('a card file belongs to its billing month and to the months of its rows', () => {
  expect(filesForMonth([card, bank], '2026-11').map((f) => f.id)).toEqual(['f1', 'f2']);
  expect(filesForMonth([card, bank], '2026-10').map((f) => f.id)).toEqual(['f1', 'f2']);
  expect(filesForMonth([card], '2026-09')).toEqual([]);
});

test('each file reads as one line, in Israel time', () => {
  expect(fileLine(card)).toBe('כרטיס 7712 · חיוב נובמבר 2026 · 82 עסקאות · הועלה 18.11.2026 10:30');
  expect(fileLine(bank)).toBe('עו"ש · 1.9.2026–10.11.2026 · 44 תנועות · הועלה 18.11.2026 10:30');
});

test('the same card and billing month, or the same checking range, counts as already uploaded', () => {
  expect(alreadyUploaded([card], { kind: 'card', cardLast4: '7712', billingMonth: '2026-11', firstDate: '2026-10-01', lastDate: '2026-10-31' })).toBe(card);
  expect(alreadyUploaded([card], { kind: 'card', cardLast4: '5218', billingMonth: '2026-11', firstDate: '2026-10-01', lastDate: '2026-10-31' })).toBeNull();
  expect(alreadyUploaded([bank], { kind: 'checking', cardLast4: null, billingMonth: null, firstDate: '2026-09-01', lastDate: '2026-11-10' })).toBe(bank);
});
