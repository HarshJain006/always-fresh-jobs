/**
 * Google authentication — same-tab redirect (avoids popup COOP issues).
 * Identity is verified on the server; client only stores a signed app session token.
 */

import type { User } from "@/database/users";
import { loginWithGoogle } from "@/routes/auth.functions";

export type AppUser = User;
export const STORAGE_KEY = "dailyresume.session";
export const SESSION_TOKEN_KEY = "dailyresume.session_token";
export const AUTH_CHANGE_EVENT = "dailyresume:auth-change";
const OAUTH_RESULT_KEY = "dailyresume.google_oauth_result";
const OAUTH_RETURN_KEY = "dailyresume.oauth_return";

/** Shared across Strict Mode remounts so we don't clear the token twice. */
let completeInFlight: Promise<AppUser> | null = null;

function notifyAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function getEnv(name: string): string {
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.[name]) {
    return (import.meta as any).env[name];
  }
  if (typeof process !== "undefined" && (process.env as any)?.[name]) {
    return (process.env as any)[name];
  }
  return "";
}

function getClientId(): string {
  return (
    getEnv("REACT_APP_GOOGLE_CLIENT_ID") ||
    getEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID") ||
    getEnv("VITE_GOOGLE_CLIENT_ID")
  );
}

/**
 * Must match an Authorized redirect URI in Google Cloud Console EXACTLY.
 * Production: https://dailyresume.in/google-callback.html
 */
function getRedirectUri(): string {
  const fromEnv =
    getEnv("VITE_GOOGLE_REDIRECT_URI") ||
    getEnv("REACT_APP_GOOGLE_REDIRECT_URI") ||
    getEnv("NEXT_PUBLIC_GOOGLE_REDIRECT_URI");

  if (fromEnv) return fromEnv.trim();

  const appUrl = (getEnv("VITE_APP_URL") || getEnv("REACT_APP_URL") || "").replace(/\/$/, "");
  if (appUrl) return `${appUrl}/google-callback.html`;

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/google-callback.html`;
  }
  return "https://dailyresume.in/google-callback.html";
}

export function getGoogleRedirectUriForDebug(): string {
  return getRedirectUri();
}

function buildAuthUrl(clientId: string, redirectUri: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    nonce,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function readStoredOAuthResult(): {
  id_token?: string;
  error?: string;
  error_description?: string;
} | null {
  try {
    const raw = window.localStorage.getItem(OAUTH_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearStoredOAuthResult() {
  try {
    window.localStorage.removeItem(OAUTH_RESULT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Finish sign-in after Google redirects back to /login?oauth=1.
 * Server verifies the Google ID token and mints an app session.
 */
export async function completeGoogleLogin(): Promise<AppUser> {
  if (typeof window === "undefined") {
    throw new Error("Google sign-in only works in the browser.");
  }

  const existingSession = getCurrentUser();
  if (existingSession && getSessionToken()) return existingSession;

  if (completeInFlight) return completeInFlight;

  completeInFlight = (async () => {
    const pending = readStoredOAuthResult();

    if (pending?.error) {
      clearStoredOAuthResult();
      throw new Error(pending.error_description || pending.error || "Google sign-in was cancelled.");
    }

    if (!pending?.id_token) {
      throw new Error(
        "Google sign-in did not return a token. Try again (allow site data / localStorage).",
      );
    }

    try {
      const result = await loginWithGoogle({ data: { idToken: pending.id_token } });
      persistSession(result.user);
      persistSessionToken(result.sessionToken);
      clearStoredOAuthResult();
      return result.user;
    } catch (err) {
      throw err;
    }
  })();

  try {
    return await completeInFlight;
  } finally {
    window.setTimeout(() => {
      completeInFlight = null;
    }, 100);
  }
}

export async function startGoogleLogin(): Promise<never> {
  if (typeof window === "undefined") {
    throw new Error("Google sign-in only works in the browser.");
  }

  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  if (!clientId) throw new Error("Google client ID is not configured.");
  if (!redirectUri) throw new Error("Google redirect URI is not configured.");

  const nonce = Math.random().toString(36).substring(2);
  const authUrl = buildAuthUrl(clientId, redirectUri, nonce);

  try {
    sessionStorage.setItem(OAUTH_RETURN_KEY, "/login?oauth=1");
  } catch {
    /* ignore */
  }

  window.location.assign(authUrl);
  return new Promise(() => {});
}

export async function googleLogin(): Promise<AppUser> {
  if (typeof window === "undefined") {
    throw new Error("Google sign-in only works in the browser.");
  }

  const pending = readStoredOAuthResult();
  if (pending?.id_token || pending?.error || (getCurrentUser() && getSessionToken())) {
    return completeGoogleLogin();
  }
  await startGoogleLogin();
  return new Promise(() => {});
}

export async function googleLoginAndGoToDashboard(dashboardPath = "/dashboard"): Promise<AppUser> {
  const user = await googleLogin();
  if (typeof window !== "undefined") {
    window.location.href = dashboardPath;
  }
  return user;
}

export function isSignedIn(): boolean {
  return getCurrentUser() !== null && !!getSessionToken();
}

export function getUserDisplayName(): string | null {
  return getCurrentUser()?.name ?? null;
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    notifyAuthChange();
  }
}

export function getCurrentUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function persistSession(user: AppUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  notifyAuthChange();
}

function persistSessionToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function updateSessionUser(user: AppUser): void {
  persistSession(user);
}

/** Helper for dashboard RPC calls — throws if missing. */
export function requireClientSessionToken(): string {
  const token = getSessionToken();
  if (!token) {
    throw new Error("Not signed in. Please sign in with Google again.");
  }
  return token;
}
