import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

/** Request-scoped Supabase client bound to the user's auth cookies (null when accounts aren't configured). */
export async function serverClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          /* called from a Server Component — the proxy refreshes cookies instead */
        }
      },
    },
  });
}

export async function currentUser(): Promise<{ db: SupabaseClient; user: User } | null> {
  const db = await serverClient();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user ? { db, user: data.user } : null;
}
