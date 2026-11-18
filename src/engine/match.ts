import type { ImportedRow } from '../import/types';
import { daysBetweenInclusive } from './dates';
import type { Txn } from './types';

/** What matching needs from a file row; card rows are expenses unless kind says otherwise. */
export type MatchRow = Pick<ImportedRow, 'date' | 'amount' | 'cardLast4' | 'importKey'> & { kind?: 'income' | 'expense' };

export interface MatchResult<R extends MatchRow = ImportedRow> {
  /** uncertain: more captured transactions fit than could be told apart; merged with the closest anyway. */
  matched: { txnId: string; row: R; uncertain: boolean }[];
  /** To insert. */
  unmatched: R[];
}

export interface MatchOptions {
  /** Bank rows: only hand-entered transactions are candidates, never card ones. */
  bank?: boolean;
}

const dayGap = (a: string, b: string) => Math.abs(daysBetweenInclusive(a, b) - 1);
/** The key without its #n suffix: rows sharing it are identical purchases. */
const groupOf = (key: string) => key.replace(/#\d+$/, '');

/**
 * Pairs file rows with transactions already captured (Google Pay, manual, or a pending row from an earlier
 * file) by amount, date ±1 day and card last 4 — never by merchant name, which differs between the phone and
 * the file. When candidates can't be told apart the closest are merged anyway and marked uncertain: the
 * amounts are equal, so merging keeps the totals right where inserting would count the purchase twice.
 */
export function matchRows<R extends MatchRow>(existing: Txn[], rows: R[], opts: MatchOptions = {}): MatchResult<R> {
  const known = new Set(existing.map((t) => t.importKey).filter((k): k is string => k !== null));
  const inFile = new Set(rows.map((r) => r.importKey));
  const used = new Set<string>();
  const res: MatchResult<R> = { matched: [], unmatched: [] };

  const open = (t: Txn) => {
    if (opts.bank) return t.importKey === null && t.cardLast4 === null && t.source !== 'google_wallet' && t.source !== 'apple_pay';
    // A pending row from an earlier file may come back charged under a new key (date or text changed).
    return t.importKey === null || (t.source === 'file' && t.status === 'pending' && !inFile.has(t.importKey));
  };

  const groups = new Map<string, R[]>();
  for (const r of rows) {
    if (known.has(r.importKey)) continue;
    const g = groupOf(r.importKey);
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }

  for (const group of groups.values()) {
    const r = group[0];
    const kind = r.kind ?? 'expense';
    const cands = existing
      .filter((t) =>
        !used.has(t.id) && t.kind === kind && open(t) && t.amount === r.amount && dayGap(t.date, r.date) <= 1 &&
        !(t.cardLast4 && r.cardLast4 && t.cardLast4 !== r.cardLast4))
      .sort((a, b) => dayGap(a.date, r.date) - dayGap(b.date, r.date));
    const k = group.length;
    const uncertain = cands.length > k && dayGap(cands[k - 1].date, r.date) === dayGap(cands[k].date, r.date);
    group.forEach((row, i) => {
      const t = cands[i];
      if (t) {
        used.add(t.id);
        res.matched.push({ txnId: t.id, row, uncertain });
      } else {
        res.unmatched.push(row);
      }
    });
  }
  return res;
}
