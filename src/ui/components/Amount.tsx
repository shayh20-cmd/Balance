import { formatShekels } from '../../engine/money';
import type { Agorot } from '../../engine/types';
import { useCountUp } from './useCountUp';

/**
 * A shekel amount, isolated as LTR so a minus sign stays in front of the number inside RTL text.
 * `animate` counts it up from 0 once on mount; the sign and colour come from the final value throughout.
 */
export default function Amount({ value, className = '', animate = false }: { value: Agorot; className?: string; animate?: boolean }) {
  const shown = useCountUp(value, animate);
  const text = value < 0 ? `-${formatShekels(Math.abs(shown))}` : formatShekels(shown);
  return (
    <bdi dir="ltr" className={`amount ${value < 0 ? 'negative' : ''} ${className}`.trim()}>
      {text}
    </bdi>
  );
}
