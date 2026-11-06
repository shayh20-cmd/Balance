import { useState, type FormEvent } from 'react';
import { supabase } from '../../data/supabase';

/**
 * Magic link plus the same email's 6-digit code. The code matters on iPhone: a link opened from mail lands in
 * Safari, whose storage the installed app doesn't share, so the link alone can't sign the app in.
 */
export default function SignIn({ notice }: { notice?: string | null }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) setError('לא הצלחנו לשלוח קישור. נסו שוב.');
    else setSentTo(email.trim());
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
    if (error) setError('הקוד שגוי או שפג תוקפו.');
  }

  return (
    <div className="card">
      <form className="form" onSubmit={send}>
        <h1>כניסה ל-Balance</h1>
        {notice && <p className="error" role="alert">{notice}</p>}
        <label>
          אימייל
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {sentTo ? <p className="muted">נשלח קישור לכתובת {sentTo}</p> : <button className="primary">שלחו לי קישור כניסה</button>}
      </form>
      {sentTo && (
        <form className="form" onSubmit={verify}>
          <label>
            או הקלידו את הקוד מהמייל
            <input inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <button className="primary">כניסה עם קוד</button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
