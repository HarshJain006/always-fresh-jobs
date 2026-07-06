/**
 * Google authentication service.
 *
 * TODO: Replace mock implementation with real Google OAuth flow
 *   (e.g. `@react-oauth/google`, Firebase Auth, or Supabase OAuth).
 *
 * All UI code should only depend on the exported functions/types below —
 * swapping the implementation later should not require touching components.
 */

import { createUser, findUserByGoogleId, type User } from "@/database/users";

export type AppUser = User;

const STORAGE_KEY = "resumepulse.session";

/** Mock Google identity for local development. */
const MOCK_GOOGLE_PROFILE = {
  google_user_id: "google-oauth2|demo-user-001",
  email: "demo@resumepulse.app",
  name: "Demo User",
  profile_image: "https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff",
};

export async function googleLogin(): Promise<AppUser> {
  // TODO: Trigger real Google OAuth here and receive { google_user_id, email, name, picture }
  await new Promise((r) => setTimeout(r, 600));

  const existing = await findUserByGoogleId(MOCK_GOOGLE_PROFILE.google_user_id);
  const user = existing ?? (await createUser(MOCK_GOOGLE_PROFILE));

  persistSession(user);
  return user;
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
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

function persistSession(user: AppUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}
