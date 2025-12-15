import { createClient } from '@supabase/supabase-js';

// Resolve Supabase credentials from multiple sources to avoid breaking builds when .env is not at project root.
const resolveEnv = (key, fallback) => {
  return (
    import.meta.env?.[key] ||
    (typeof process !== 'undefined' ? process.env?.[key] : undefined) ||
    (typeof window !== 'undefined' ? window[`__${key}`] : undefined) ||
    fallback
  );
};

const supabaseUrl = resolveEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = resolveEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL/key are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
