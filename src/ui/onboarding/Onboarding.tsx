import { useState, type FormEvent } from 'react';
import { createHousehold } from '../../data/repo';
import { errorText } from '../errors';

export default function Onboarding({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createHousehold(name.trim(), displayName.trim());
      onCreated();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h1>משק בית חדש</h1>
      <label>
        שם משק הבית
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        השם שלך
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>יצירת משק בית</button>
    </form>
  );
}
