import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, requiredEnv } from "@/lib/env";

let cached: SupabaseClient | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(env("SUPABASE_URL") && (env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY")));
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!secretKey) throw new Error("Missing server configuration: SUPABASE_SECRET_KEY");
  cached = createClient(requiredEnv("SUPABASE_URL"), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
