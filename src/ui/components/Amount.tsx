import { formatShekels } from '../../engine/money';
import type { Agorot } from '../../engine/types';

/** A shekel amount, isolated as LTR so a minus sign stays in front of the number inside RTL text. */
export default function Amount({ value, className = '' }: { value: Agorot; className?: string }) {
  return (
    <bdi dir="ltr" className={`amount ${value < 0 ? 'negative' : ''} ${className}`.trim()}>
      {formatShekels(value)}
    </bdi>
  );
}
