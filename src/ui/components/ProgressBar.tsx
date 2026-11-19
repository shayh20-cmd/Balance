export default function ProgressBar({ value, max, tone = 'good' }: { value: number; max: number; tone?: 'good' | 'warn' | 'bad' | 'income' | 'fixed' | 'variable' | 'week' }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : value > 0 ? 1 : 0;
  return (
    <div className="bar" role="presentation">
      <i className={tone} style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}
