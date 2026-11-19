import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createDevice, listDevices, revokeDevice, type Device } from '../../data/repo';
import { supabaseKey } from '../../data/supabase';
import { useHousehold } from '../household';
import ConfirmDialog from './ConfirmDialog';
import DeviceList from './DeviceList';
import DeviceSetup from './DeviceSetup';

/** Settings → automatic intake: phones that forward card notifications to Balance. */
export default function DevicesSection() {
  const { household } = useHousehold();
  const [devices, setDevices] = useState<Device[]>([]);
  const [name, setName] = useState('');
  const [shown, setShown] = useState<string | null>(null); // token whose setup is open
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listDevices(household.id).then(setDevices, () => setError('לא הצלחנו לטעון את הטלפונים.'));
  }, [household.id]);
  useEffect(reload, [reload]);

  async function connect(e: FormEvent) {
    e.preventDefault();
    try {
      setShown(await createDevice(name.trim()));
      setName('');
      setError(null);
      reload();
    } catch {
      setError('לא הצלחנו לחבר את הטלפון.');
    }
  }

  async function revoke() {
    if (!revoking) return;
    try {
      await revokeDevice(revoking);
      setShown(null);
      reload();
    } catch {
      setError('הניתוק נכשל. נסו שוב.');
    }
    setRevoking(null);
  }

  return (
    <section className="card">
      <h2>קליטה אוטומטית</h2>
      <p className="muted">טלפון מחובר שולח ל-Balance כל התראת עסקה מאפליקציית מקס (ו-Google Wallet), והעסקה נכנסת לבד.</p>
      <DeviceList devices={devices} onRevoke={setRevoking} onShow={(d) => setShown(shown === d.token ? null : d.token)} />
      {shown && <DeviceSetup token={shown} apiKey={supabaseKey} />}
      <form className="form" onSubmit={connect}>
        <label>
          שם הטלפון
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="הטלפון של שי" required />
        </label>
        <button className="primary">חיבור טלפון</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {revoking && (
        <ConfirmDialog
          text="לנתק את הטלפון? עסקאות ממנו יפסיקו להיקלט עד שתחברו אותו מחדש."
          confirmLabel="ניתוק"
          onConfirm={revoke}
          onCancel={() => setRevoking(null)}
        />
      )}
    </section>
  );
}
