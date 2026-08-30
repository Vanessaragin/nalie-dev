import { createBrowserClient } from '@supabase/ssr';

export function createClient(options?: { detectSessionInUrl?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey || url.includes('your-project')) {
    throw new Error('Supabase DEV ainda não foi configurado.');
  }

  return createBrowserClient(
    url,
    publishableKey,
    options?.detectSessionInUrl === false
      ? { auth: { detectSessionInUrl: false } }
      : undefined,
  );
}
