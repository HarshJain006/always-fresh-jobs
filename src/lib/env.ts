/**
 * Shared env helper — works in Vite (import.meta.env) and Node (process.env).
 */

export function getEnv(name: string): string {
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.[name]) {
    return String((import.meta as any).env[name]);
  }
  if (typeof process !== "undefined" && process.env?.[name]) {
    return String(process.env[name]);
  }
  return "";
}

export function getSupabaseUrl(): string {
  return (
    getEnv("VITE_SUPABASE_URL") ||
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    getEnv("SUPABASE_URL")
  );
}

export function getSupabasePublishableKey(): string {
  return (
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_PUBLISHABLE_KEY")
  );
}
