import type { Source } from '../../engine/types';

const labels: Record<Source, string> = {
  apple_pay: 'Apple Pay',
  google_wallet: 'Google Wallet',
  sms: 'SMS',
  email: 'מייל',
  file: 'קובץ',
  manual: 'ידני',
};

export default function SourcePill({ source }: { source: Source }) {
  return <span className="pill">{labels[source]}</span>;
}
