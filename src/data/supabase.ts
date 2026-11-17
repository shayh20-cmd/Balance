import { createClient } from '@supabase/supabase-js';

/** The query string at page load, captured before the client below strips an auth ?code= from it. */
export const launchSearch = typeof location === 'undefined' ? '' : location.search;

// Falls back to a placeholder so tests and a missing .env.local don't crash at import; calls will then fail.
export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
export const supabaseKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-anon-key';

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  // PKCE returns the magic link as ?code=, which doesn't collide with the HashRouter's #/ routes
  { auth: { flowType: 'pkce' } },
);
