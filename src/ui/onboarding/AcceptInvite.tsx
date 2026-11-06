import { useState, type FormEvent } from 'react';
import { acceptInvite } from '../../data/repo';
import { errorText } from '../errors';

export default function AcceptInvite({ token, onJoined }: { token: string; onJoined: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(token, displayName.trim());
      onJoined();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h1>הצטרפות למשק בית</h1>
      <label>
        השם שלך
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>הצטרפות</button>
    </form>
  );
}
