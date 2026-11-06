// Maps the codes raised by the database RPCs to the Hebrew messages users see.
const messages: Record<string, string> = {
  not_allowlisted: 'הכתובת הזו עדיין לא הוזמנה ל-Balance. בקשו הזמנה ממי ששלח לכם את הקישור.',
  invite_invalid: 'ההזמנה לא בתוקף או שנשלחה לכתובת אחרת.',
  already_member: 'כבר יש לך משק בית ב-Balance.',
};

export function errorText(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = Object.keys(messages).find((c) => message.includes(c));
  return code ? messages[code] : 'משהו השתבש. נסו שוב.';
}
