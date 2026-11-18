import readXlsxFile from 'read-excel-file/universal';
import type { Sheet } from './types';

/** Reads every worksheet of an .xlsx file. The only module that touches the Excel library. */
export async function readWorkbook(data: ArrayBuffer | Blob): Promise<Sheet[]> {
  const sheets = await readXlsxFile(data);
  return sheets.map((s) => ({ name: s.sheet, rows: s.data as unknown[][] }));
}
