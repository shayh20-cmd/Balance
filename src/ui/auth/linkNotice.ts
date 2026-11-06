/**
 * A magic link that came back with ?code= but no session was opened in another browser context (on iPhone the
 * mail link opens Safari, not the installed app), or Supabase sent an error. Either way, point to the code.
 * `search` must be the URL as it was at page load: supabase-js strips ?code= while it initialises.
 */
export function linkFailureNotice(search: string, hasSession: boolean): string | null {
  const params = new URLSearchParams(search);
  const failed = params.has('error') || params.has('error_description') || (params.has('code') && !hasSession);
  return failed ? 'קישור הכניסה לא הצליח כאן. בקשו קישור חדש והקלידו את הקוד מהמייל.' : null;
}
