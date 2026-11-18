"""Writes synthetic Leumi exports for the import tests. Every name, ID and card number here is invented.

Run: python tests/fixtures/make_leumi_fixtures.py
The layout copies Leumi's real card export (observed 2026-11-17): three header rows, a column-header row,
data rows, an empty row, 'סך הכל' and the total.
"""
from pathlib import Path

from openpyxl import Workbook

HERE = Path(__file__).parent
OWNER = 'ישראל ישראלי-000000000'
CARD = '1111-לאומי מאסטרקארד'
BILLING = '12/2026'
COLUMNS = [
    'תאריך עסקה', 'שם בית העסק', 'קטגוריה', '4 ספרות אחרונות של כרטיס האשראי', 'סוג עסקה', 'סכום חיוב',
    'מטבע חיוב', 'סכום עסקה מקורי', 'מטבע עסקה מקורי', 'תאריך חיוב', 'הערות', 'תיוגים', 'מועדון הנחות',
    'מפתח דיסקונט', 'אופן ביצוע ההעסקה', 'שער המרה ממטבע מקור/התחשבנות לש"ח',
]


def card_sheet(wb, title, rows, total, first=False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    for r in [[OWNER], [CARD], [BILLING], COLUMNS, *rows, [], ['סך הכל'], [total]]:
        ws.append(r)


def make_card():
    wb = Workbook()
    card_sheet(wb, 'עסקאות במועד החיוב', [
        ['22-06-2026', 'ליברה ביטוח חובה', 'ביטוח', '1111', 'תשלומים', 122, '₪', 1220, '₪', '02-12-2026', 'תשלום 6 מתוך 10'],
        ['01-11-2026', 'שומשום קונקורד', 'מסעדות, קפה וברים', '1111', 'רגילה', 57.13, '₪', 57.13, '₪', '02-12-2026'],
        ['02-11-2026', 'EXPRESS 7', 'מזון וצריכה', '1111', 'רגילה', 12, '₪', 12, '₪', '02-12-2026'],
        ['02-11-2026', 'EXPRESS 7', 'מזון וצריכה', '1111', 'רגילה', 12, '₪', 12, '₪', '02-12-2026'],
        ['03-11-2026', 'חנות', 'שונות', '1111', 'זיכוי', -40, '₪', -40, '₪', '02-12-2026'],
    ], '163.13₪', first=True)
    card_sheet(wb, 'עסקאות שאושרו וטרם נקלטו', [
        ['17-11-2026', "ג'ינג'ז מרקט קרליבך", 'מזון וצריכה', '1111', 'רגילה', None, None, 41.64, '₪'],
    ], '0')
    card_sheet(wb, 'עסקאות חו"ל ומט"ח', [
        ['05-11-2026', 'GOOGLE CLAUDE BY ANTH  MOUNTAIN VIEW USA', 'פנאי, בידור וספורט', '1111', 'חיוב חודשי', 60, '₪', 60,
         '₪', '02-12-2026', 'חיוב עסקת חו"ל בש"ח '],
    ], '60₪')
    wb.save(HERE / 'leumi-card.xlsx')


if __name__ == '__main__':
    make_card()
