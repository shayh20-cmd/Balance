import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as repo from '../../src/data/repo';
import { supabase } from '../../src/data/supabase';
import SignIn from '../../src/ui/auth/SignIn';
import AcceptInvite from '../../src/ui/onboarding/AcceptInvite';
import Onboarding from '../../src/ui/onboarding/Onboarding';

vi.mock('../../src/data/repo', () => ({ createHousehold: vi.fn(), acceptInvite: vi.fn() }));
vi.mock('../../src/data/supabase', () => ({
  supabase: { auth: { signInWithOtp: vi.fn(async () => ({ error: null })), verifyOtp: vi.fn(), signOut: vi.fn() } },
}));
const acceptInvite = vi.mocked(repo.acceptInvite);
const verifyOtp = vi.mocked(supabase.auth.verifyOtp);

beforeEach(() => {
  acceptInvite.mockReset();
  verifyOtp.mockReset();
});

test('an invalid invite reports it, drops the pending token, and offers a way out', async () => {
  acceptInvite.mockImplementation(async () => { throw new Error('invite_invalid'); });
  const onInvalid = vi.fn();
  const onDecline = vi.fn();
  render(<AcceptInvite token="t" onJoined={vi.fn()} onInvalid={onInvalid} onDecline={onDecline} />);
  await userEvent.type(screen.getByLabelText('השם שלך'), 'ג');
  await userEvent.click(screen.getByRole('button', { name: 'הצטרפות' }));
  expect(await screen.findByText('ההזמנה לא בתוקף או שנשלחה לכתובת אחרת.')).toBeInTheDocument();
  expect(onInvalid).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'יצירת משק בית חדש במקום' }));
  expect(onDecline).toHaveBeenCalled();
});

test('Onboarding and AcceptInvite both offer sign-out', async () => {
  const { unmount } = render(<Onboarding onCreated={vi.fn()} />);
  expect(screen.getByText('קיבלתם הזמנה למשק בית קיים? פתחו שוב את קישור ההזמנה.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'יציאה' }));
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  unmount();
  render(<AcceptInvite token="t" onJoined={vi.fn()} onInvalid={vi.fn()} onDecline={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'יציאה' }));
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(2);
});

test('SignIn accepts the 6-digit code from the email', async () => {
  verifyOtp.mockImplementation(async () => ({ data: {}, error: null }) as never);
  render(<SignIn />);
  await userEvent.type(screen.getByLabelText('אימייל'), 'a@x.com');
  await userEvent.click(screen.getByRole('button', { name: 'שלחו לי קישור כניסה' }));
  await userEvent.type(screen.getByLabelText('או הקלידו את הקוד מהמייל'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'כניסה עם קוד' }));
  expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@x.com', token: '123456', type: 'email' });
});

test('a wrong code shows an error', async () => {
  verifyOtp.mockImplementation(async () => ({ data: {}, error: { message: 'bad' } }) as never);
  render(<SignIn />);
  await userEvent.type(screen.getByLabelText('אימייל'), 'a@x.com');
  await userEvent.click(screen.getByRole('button', { name: 'שלחו לי קישור כניסה' }));
  await userEvent.type(screen.getByLabelText('או הקלידו את הקוד מהמייל'), '000000');
  await userEvent.click(screen.getByRole('button', { name: 'כניסה עם קוד' }));
  expect(await screen.findByText('הקוד שגוי או שפג תוקפו.')).toBeInTheDocument();
});

test('SignIn shows a notice passed from a failed link', () => {
  render(<SignIn notice="קישור הכניסה נפתח בדפדפן אחר. הקלידו את הקוד מהמייל." />);
  expect(screen.getByText('קישור הכניסה נפתח בדפדפן אחר. הקלידו את הקוד מהמייל.')).toBeInTheDocument();
});
