import { createClient } from '@supabase/supabase-js';

// Falls back to a placeholder so tests and a missing .env.local don't crash at import; calls will then fail.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-anon-key',
);
