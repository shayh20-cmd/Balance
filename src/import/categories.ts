/** Leumi's card categories → Balance's default category names (create_household's list). */
const MAP: Record<string, string> = {
  'מזון וצריכה': 'סופר',
  'מסעדות, קפה וברים': 'אוכל בחוץ',
  'תחבורה ורכבים': 'דלק ותחבורה',
  'דלק, חשמל וגז': 'דלק ותחבורה',
  'רפואה ובתי מרקחת': 'בריאות',
  'פנאי, בידור וספורט': 'פנאי',
  'טיסות ותיירות': 'פנאי',
  'אופנה': 'קניות',
  'ציוד ומשרד': 'קניות',
  'מוצרי חשמל': 'קניות',
  'עיצוב הבית': 'בית',
  'ביטוח': 'בית',
  'עירייה וממשלה': 'בית',
  'שירותי תקשורת': 'בית',
  'קוסמטיקה וטיפוח': 'קניות',
};

export function leumiCategoryToOurs(leumi: string | null): string {
  return (leumi && MAP[leumi.trim()]) || 'אחר';
}
