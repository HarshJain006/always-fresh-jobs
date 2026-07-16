/**
 * Supabase clients — publishable (browser, no table access after lockdown)
 * and service role (server-only, required for all DB/storage I/O).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

let publicClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

function getSupabaseServiceRoleKey(): string {
  // NEVER read VITE_* — would leak into the browser bundle
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

/** Browser + isomorphic reads (anon key). After RLS lockdown this cannot read app tables. */
export function getSupabase(): SupabaseClient {
  if (publicClient) return publicClient;
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  publicClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return publicClient;
}

/**
 * Server-only client. Requires SUPABASE_SERVICE_ROLE_KEY — no anon fallback.
 */
export function getSupabaseServer(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseServer() must not run in the browser.");
  }
  if (serverClient) return serverClient;
  const url = getSupabaseUrl() || getEnv("SUPABASE_URL");
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new Error(
      "Server Supabase is not configured. Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverClient;
}

export function formatSupabaseError(err: unknown, context: string): Error {
  if (err && typeof err === "object") {
    const e = err as { message?: string; error?: string; statusCode?: string; hint?: string };
    const parts = [context, e.message || e.error, e.hint].filter(Boolean);
    const msg = parts.join(" — ");
    if (msg) return new Error(msg);
  }
  return new Error(`${context}: ${String(err)}`);
}
