import { useEffect, useRef, useState } from 'react';

function canAnimate(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function' || typeof window.requestAnimationFrame !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Counts the magnitude of `target` up from 0 once, on first mount, easing out over `durationMs`.
 * Later changes to `target` jump straight to it. Without motion support it returns `target` at once.
 */
export function useCountUp(target: number, enabled: boolean, durationMs = 1100): number {
  const [animating] = useState(() => enabled && target !== 0 && canAnimate());
  const [shown, setShown] = useState(animating ? 0 : target);
  const done = useRef(!animating);
  const latest = useRef(target);
  latest.current = target;

  useEffect(() => {
    if (done.current) return;
    let start: number | null = null;
    let id = 0;
    const frame = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      // whole shekels while counting (agorot / 100), so no cents flicker by
      setShown(Math.round((Math.abs(latest.current) * eased) / 100) * 100);
      if (p < 1) id = window.requestAnimationFrame(frame);
      else done.current = true;
    };
    id = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(id);
    // runs once: a target that changes mid-count is followed through `latest`, and after that shown directly
  }, []);

  return done.current ? target : Math.sign(target) * shown;
}
