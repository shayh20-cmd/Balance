import { act, render, screen } from '@testing-library/react';
import Amount from '../../src/ui/components/Amount';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A browser that animates: matchMedia without reduced motion, and rAF frames we step by hand. */
function stubAnimatingBrowser() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return (now: number) => {
    const run = frames.splice(0);
    act(() => run.forEach((cb) => cb(now)));
  };
}

test('shows the final value immediately when matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined);
  render(<Amount value={684000} animate />);
  expect(screen.getByText('6,840 ₪')).toBeInTheDocument();
});

test('reduced motion shows the final value immediately', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  render(<Amount value={684000} animate />);
  expect(screen.getByText('6,840 ₪')).toBeInTheDocument();
});

test('negative value keeps its minus sign while counting, and ends on the value', () => {
  const step = stubAnimatingBrowser();
  const { container } = render(<Amount value={-32000} animate />);
  const el = container.querySelector('bdi')!;
  expect(el.textContent!.startsWith('-')).toBe(true);
  expect(el).toHaveClass('negative');
  step(0);
  expect(el.textContent).toBe('-0 ₪');
  step(300);
  expect(el.textContent!.startsWith('-')).toBe(true);
  expect(el.textContent).not.toBe('-320 ₪');
  step(5000);
  expect(el.textContent).toBe('-320 ₪');
});

test('a later value change jumps without counting', () => {
  const step = stubAnimatingBrowser();
  const { container, rerender } = render(<Amount value={100000} animate />);
  step(0);
  step(5000);
  rerender(<Amount value={250000} animate />);
  expect(container.querySelector('bdi')!.textContent).toBe('2,500 ₪');
});
