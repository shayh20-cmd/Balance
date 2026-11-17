import { supabaseUrl } from '../../data/supabase';
import { useToast } from '../toast';

export const INGEST_URL = `${supabaseUrl}/rest/v1/rpc/ingest_notification`;

/** The JSON MacroDroid posts. [not_title] and [notification] are MacroDroid's own variables. */
export function ingestBody(token: string): string {
  return JSON.stringify({ p_token: token, p_title: '[not_title]', p_text: '[notification]' });
}

function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast('הועתק');
    } catch {
      /* the field stays selectable */
    }
  }
  return (
    <label>
      {label}
      <span className="copy-field">
        <input readOnly dir="ltr" value={value} aria-label={label} onFocus={(e) => e.target.select()} />
        <button type="button" onClick={copy}>העתקה</button>
      </span>
    </label>
  );
}

/** What to type into MacroDroid on the phone so each Google Wallet notification reaches Balance. */
export default function DeviceSetup({ token, apiKey }: { token: string; apiKey: string }) {
  return (
    <div className="form device-setup">
      <p className="muted">את ההגדרה עושים פעם אחת בטלפון, באפליקציה החינמית MacroDroid (מ-Google Play).</p>
      <ol>
        <li>
          פותחים את MacroDroid ולוחצים <b dir="ltr">Add Macro</b>.
        </li>
        <li>
          <b>טריגר:</b> לוחצים על הפלוס ליד <b dir="ltr">Triggers</b>, ובוחרים
          <br />
          <b dir="ltr">Device Events → Notification Received</b>
          <br />
          ובו <b dir="ltr">Select Application(s)</b> ומסמנים את <b dir="ltr">Google Wallet</b>.
        </li>
        <li>
          <b>פעולה:</b> לוחצים על הפלוס ליד <b dir="ltr">Actions</b>, ובוחרים
          <br />
          <b dir="ltr">Connectivity → HTTP Request</b>
          <br />
          שיטה <b dir="ltr">POST</b>, ומעתיקים לשם את שלושת השדות שכאן.
        </li>
        <li>
          תחת <b dir="ltr">Headers</b> מוסיפים כותרת בשם <b dir="ltr">apikey</b> עם הערך שכאן, ובסוג התוכן בוחרים
          <b dir="ltr"> application/json</b>.
        </li>
        <li>
          שומרים את המאקרו בשם <b dir="ltr">Balance</b>. בפעם הראשונה MacroDroid יבקש הרשאה לקרוא התראות; מאשרים.
        </li>
      </ol>
      <CopyField label="כתובת" value={INGEST_URL} />
      <CopyField label="ערך הכותרת apikey" value={apiKey} />
      <CopyField label="גוף הבקשה" value={ingestBody(token)} />
      <p className="muted">הקוד בגוף הבקשה הוא הסיסמה של הטלפון הזה. לא משתפים אותו; אם דלף, מנתקים את הטלפון ויוצרים חדש.</p>
    </div>
  );
}
