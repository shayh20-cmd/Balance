import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import DeviceSetup, { ingestBody, INGEST_URL } from '../../src/ui/components/DeviceSetup';
import DeviceList from '../../src/ui/components/DeviceList';

test('the request body carries the token and the MacroDroid notification variables', () => {
  expect(JSON.parse(ingestBody('tok-123'))).toEqual({ p_token: 'tok-123', p_title: '[not_title]', p_text: '[notification]' });
  expect(INGEST_URL).toMatch(/\/rest\/v1\/rpc\/ingest_notification$/);
});

test('setup shows the address, the key header and the body to copy', () => {
  render(<DeviceSetup token="tok-123" apiKey="sb_publishable_x" />);
  expect(screen.getByLabelText('כתובת')).toHaveValue(INGEST_URL);
  expect(screen.getByLabelText('ערך הכותרת apikey')).toHaveValue('sb_publishable_x');
  expect(screen.getByLabelText('גוף הבקשה')).toHaveValue(ingestBody('tok-123'));
  expect(screen.getByText(/Notification Received/)).toBeInTheDocument();
});

test('device list shows each phone with its last activity and lets you disconnect it', async () => {
  const onRevoke = vi.fn();
  render(
    <DeviceList
      devices={[
        { id: 'd1', name: 'הטלפון של שי', lastSeenAt: '2026-11-17T13:05:00Z', token: 't1' },
        { id: 'd2', name: 'טאבלט', lastSeenAt: null, token: 't2' },
      ]}
      onRevoke={onRevoke}
      onShow={vi.fn()}
    />,
  );
  expect(screen.getByText('הטלפון של שי')).toBeInTheDocument();
  expect(screen.getByText('עסקה אחרונה: 17.11.2026 15:05')).toBeInTheDocument();
  expect(screen.getByText('עוד לא התקבלה עסקה')).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'ניתוק' })[1]);
  expect(onRevoke).toHaveBeenCalledWith('d2');
});
