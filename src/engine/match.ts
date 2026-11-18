import type { ImportedRow } from '../import/types';
import { daysBetweenInclusive } from './dates';
import type { Txn } from './types';

export interface MatchResult {
  matched: { txnId: string; row: ImportedRow }[];
  /** To insert. */
  unmatched: ImportedRow[];
  /** To insert with needsReview: more captured transactions fit than can be told apart. */
  ambiguous: ImportedRow[];
}

const dayGap = (a: string, b: string) => Math.abs(daysBetweenInclusive(a, b) - 1);
/** The key without its #n suffix: rows sharing it are identical purchases. */
const groupOf = (key: string) => key.replace(/#\d+$/, '');

/**
 * Pairs file rows with transactions already captured (Google Pay, manual) by amount, date ±1 day and card
 * last 4 — never by merchant name, which differs between the phone and the file.
 */
export function matchRows(existing: Txn[], rows: ImportedRow[]): MatchResult {
  const known = new Set(existing.map((t) => t.importKey).filter((k): k is string => k !== null));
  const used = new Set<string>();
  const res: MatchResult = { matched: [], unmatched: [], ambiguous: [] };

  const groups = new Map<string, ImportedRow[]>();
  for (const r of rows) {
    if (known.has(r.importKey)) continue;
    const g = groupOf(r.importKey);
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }

  for (const group of groups.values()) {
    const r = group[0];
    const cands = existing
      .filter((t) =>
        !used.has(t.id) && t.kind === 'expense' && t.importKey === null && t.amount === r.amount &&
        dayGap(t.date, r.date) <= 1 && !(t.cardLast4 && r.cardLast4 && t.cardLast4 !== r.cardLast4))
      .sort((a, b) => dayGap(a.date, r.date) - dayGap(b.date, r.date));
    const k = group.length;
    if (cands.length > k && dayGap(cands[k - 1].date, r.date) === dayGap(cands[k].date, r.date)) {
      res.ambiguous.push(...group);
      continue;
    }
    group.forEach((row, i) => {
      const t = cands[i];
      if (t) {
        used.add(t.id);
        res.matched.push({ txnId: t.id, row });
      } else {
        res.unmatched.push(row);
      }
    });
  }
  return res;
}
