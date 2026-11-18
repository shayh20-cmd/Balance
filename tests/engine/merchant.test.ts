import { merchantKey } from '../../src/engine/merchant';

test.each([
  ['EXPRESS 7', 'express'],
  ['יאלי בשכונה בע"מ', 'יאלי בשכונה בעמ'],
  ['  ', ''],
  ['NETFLIX.COM            AMSTERDAM     NLD', 'netflixcom amsterdam nld'],
  ["ג'ינג'ז   מרקט", 'גינגז מרקט'],
])('%s → %s', (name, key) => {
  expect(merchantKey(name)).toBe(key);
});
