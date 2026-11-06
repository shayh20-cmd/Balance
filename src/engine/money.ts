import type { Agorot } from './types';

export function formatShekels(a: Agorot): string {
  const sign = a < 0 ? '-' : '';
  const abs = Math.abs(a);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const wholeText = whole.toLocaleString('en-US');
  return cents === 0 ? `${sign}${wholeText} ₪` : `${sign}${wholeText}.${String(cents).padStart(2, '0')} ₪`;
}

export function toAgorot(shekels: string | number): Agorot {
  const text = String(shekels).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error(`invalid amount: ${shekels}`);
  return Math.round(Number(text) * 100);
}
