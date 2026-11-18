import { addMonths } from '../engine/dates';
import type { ISODate, Month } from '../engine/types';
import { monthName, shortDate } from '../ui/format';
import { currentUserId } from './repo';
import { supabase } from './supabase';

/** One uploaded file, as the close screen lists it. */
export interface ImportFile {
  id: string;
  uploadedAt: string;
  fileName: string;
  kind: 'card' | 'checking';
  cardLast4: string | null;
  billingMonth: Month | null;
  firstDate: ISODate | null;
  lastDate: ISODate | null;
  rowCount: number;
  matched: number;
  added: number;
  review: number;
}

export type ImportFileEntry = Omit<ImportFile, 'id' | 'uploadedAt'>;
type Identity = Pick<ImportFile, 'kind' | 'cardLast4' | 'billingMonth' | 'firstDate' | 'lastDate'>;

interface ImportFileRow {
  id: string; uploaded_at: string; file_name: string; kind: ImportFile['kind']; card_last4: string | null;
  billing_month: string | null; first_date: string | null; last_date: string | null; row_count: number;
  matched: number; added: number; review: number;
}

/** A file shows on its billing month's close and on every month its rows fall in. */
export function filesForMonth(files: ImportFile[], month: Month): ImportFile[] {
  const start = `${month}-01`;
  const end = `${addMonths(month, 1)}-01`;
  return files.filter((f) => f.billingMonth === month || (!!f.firstDate && !!f.lastDate && f.firstDate < end && f.lastDate >= start));
}

const israelTime = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return `${p('day')}.${p('month')}.${p('year')} ${p('hour')}:${p('minute')}`;
};

export function fileLine(f: ImportFile): string {
  const when = `הועלה ${israelTime(f.uploadedAt)}`;
  if (f.kind === 'card') {
    const billing = f.billingMonth ? ` · חיוב ${monthName(f.billingMonth)} ${f.billingMonth.slice(0, 4)}` : '';
    return `כרטיס ${f.cardLast4 ?? ''}${billing} · ${f.rowCount} עסקאות · ${when}`;
  }
  const range = f.firstDate && f.lastDate ? ` · ${shortDate(f.firstDate)}–${shortDate(f.lastDate)}` : '';
  return `עו"ש${range} · ${f.rowCount} תנועות · ${when}`;
}

/** The earlier upload of the same file: same card and billing month, or the same checking date range. */
export function alreadyUploaded(files: ImportFile[], f: Identity): ImportFile | null {
  return files.find((x) =>
    x.kind === f.kind &&
    (f.kind === 'card'
      ? x.cardLast4 === f.cardLast4 && x.billingMonth === f.billingMonth
      : x.firstDate === f.firstDate && x.lastDate === f.lastDate)) ?? null;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const fromRow = (r: ImportFileRow): ImportFile => ({
  id: r.id, uploadedAt: r.uploaded_at, fileName: r.file_name, kind: r.kind, cardLast4: r.card_last4,
  billingMonth: r.billing_month ? r.billing_month.slice(0, 7) : null, firstDate: r.first_date, lastDate: r.last_date,
  rowCount: r.row_count, matched: r.matched, added: r.added, review: r.review,
});

export async function loadImportFiles(householdId: string): Promise<ImportFile[]> {
  const rows = check(await supabase.from('import_files').select('*').eq('household_id', householdId).order('uploaded_at')) as ImportFileRow[];
  return rows.map(fromRow);
}

export async function logImport(householdId: string, e: ImportFileEntry): Promise<ImportFile> {
  const uid = await currentUserId();
  const row = check(await supabase.from('import_files').insert({
    household_id: householdId, uploaded_by: uid, file_name: e.fileName, kind: e.kind, card_last4: e.cardLast4,
    billing_month: e.billingMonth ? `${e.billingMonth}-01` : null, first_date: e.firstDate, last_date: e.lastDate,
    row_count: e.rowCount, matched: e.matched, added: e.added, review: e.review,
  }).select('*').single()) as ImportFileRow;
  return fromRow(row);
}
