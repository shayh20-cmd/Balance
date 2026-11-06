import { useState, type FormEvent } from 'react';
import { supabase } from '../../data/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) setError('לא הצלחנו לשלוח קישור. נסו שוב.');
    else setSentTo(email.trim());
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h1>כניסה ל-Balance</h1>
      <label>
        אימייל
        <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {sentTo ? <p className="muted">נשלח קישור לכתובת {sentTo}</p> : <button className="primary">שלחו לי קישור כניסה</button>}
    </form>
  );
}
