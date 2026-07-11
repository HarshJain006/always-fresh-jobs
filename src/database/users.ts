/**
 * Users data access.
 *
 * TODO: Replace in-memory store with real database calls once a provider is chosen.
 * Every function should return the same shape — components should not care where data lives.
 */

import { getClient } from "./connection";
import type { AccountStatus, SubscriptionStatus, User } from "./schemas";

export type { User } from "./schemas";

const TRIAL_DAYS = 3;

// In-memory store, seeded across a session by localStorage-backed auth.
const users = new Map<string, User>();

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  getClient();
  for (const u of users.values()) if (u.google_user_id === googleId) return u;

  // Reconstruct from persisted session if the module was hot-reloaded.
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("dailyresume.session");
      if (raw) {
        const u = JSON.parse(raw) as User;
        if (u.google_user_id === googleId) {
          users.set(u.id, u);
          return u;
        }
      }
    } catch {
      /* noop */
    }
  }
  return null;
}

export async function createUser(input: {
  google_user_id: string;
  email: string;
  name: string;
  profile_image: string;
}): Promise<User> {
  getClient();

  // Trial-abuse prevention: block if we already saw this Google ID (even soft-deleted).
  const existing = await findUserByGoogleId(input.google_user_id);
  if (existing) return existing;

  const now = new Date();
  const trialExpire = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const user: User = {
    id: crypto.randomUUID(),
    google_user_id: input.google_user_id,
    email: input.email,
    name: input.name,
    profile_image: input.profile_image,
    created_at: now.toISOString(),
    trial_started_at: now.toISOString(),
    trial_expire_at: trialExpire.toISOString(),
    trial_used: true,
    subscription_status: "trial",
    subscription_plan: "free_trial",
    subscription_started_at: null,
    subscription_expire_at: null,
    account_status: "active",
  };
  users.set(user.id, user);
  return user;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  const current = users.get(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  users.set(id, next);
  return next;
}

export async function deleteUser(id: string): Promise<void> {
  // NOTE: We soft-delete to preserve trial_used across account deletions and
  // prevent free-trial abuse via re-signup with the same Google account.
  const current = users.get(id);
  if (!current) return;
  users.set(id, { ...current, account_status: "deleted" as AccountStatus });
}

export function checkTrialStatus(user: User): { active: boolean; daysRemaining: number } {
  const expire = new Date(user.trial_expire_at).getTime();
  const now = Date.now();
  const msLeft = expire - now;
  const days = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  return { active: msLeft > 0 && user.subscription_status === "trial", daysRemaining: days };
}

export function checkSubscriptionStatus(user: User): SubscriptionStatus {
  if (user.subscription_status === "active") {
    const exp = user.subscription_expire_at ? new Date(user.subscription_expire_at).getTime() : 0;
    if (exp && exp < Date.now()) return "expired";
    return "active";
  }
  const trial = checkTrialStatus(user);
  if (trial.active) return "trial";
  return "expired";
}
