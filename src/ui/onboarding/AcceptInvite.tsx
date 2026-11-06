import { useState, type FormEvent } from 'react';
import { acceptInvite } from '../../data/repo';
import { supabase } from '../../data/supabase';
import { errorText } from '../errors';

export default function AcceptInvite({ token, onJoined, onInvalid, onDecline }: {
  token: string;
  onJoined: () => void;
  onInvalid: () => void; // the invite can't be used: forget it
  onDecline: () => void; // go create a household instead
}) {
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
      if (err instanceof Error && /invite_invalid|already_member/.test(err.message)) onInvalid();
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
      <button type="button" onClick={onDecline}>יצירת משק בית חדש במקום</button>
      <button type="button" onClick={() => supabase.auth.signOut()}>יציאה</button>
    </form>
  );
}
