import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as repo from '../../src/data/repo';
import Onboarding from '../../src/ui/onboarding/Onboarding';

vi.mock('../../src/data/repo', () => ({ createHousehold: vi.fn() }));
const createHousehold = vi.mocked(repo.createHousehold);

beforeEach(() => { createHousehold.mockReset(); });

async function fill() {
  await userEvent.type(screen.getByLabelText('שם משק הבית'), 'בית כהן');
  await userEvent.type(screen.getByLabelText('השם שלך'), 'שי');
  await userEvent.click(screen.getByRole('button', { name: 'יצירת משק בית' }));
}

test('Onboarding calls createHousehold with the typed names', async () => {
  createHousehold.mockResolvedValue('h1');
  const onCreated = vi.fn();
  render(<Onboarding onCreated={onCreated} />);
  await fill();
  expect(createHousehold).toHaveBeenCalledWith('בית כהן', 'שי');
  expect(onCreated).toHaveBeenCalled();
});

test('Onboarding shows the not-invited message when the email is not allowlisted', async () => {
  createHousehold.mockImplementation(async () => { throw new Error('not_allowlisted'); });
  render(<Onboarding onCreated={vi.fn()} />);
  await fill();
  expect(await screen.findByText('הכתובת הזו עדיין לא הוזמנה ל-Balance. בקשו הזמנה ממי ששלח לכם את הקישור.')).toBeInTheDocument();
});
