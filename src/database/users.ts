/**
 * Users data access — Supabase-backed with in-memory fallback.
 *
 * Free trial is permanent per Google account (google_user_id):
 * - Created once on first signup (server clocks only)
 * - Never reset on re-login
 * - Never taken from the client session
 */

import { getClient } from "./connection";
import type { AccountStatus, SubscriptionStatus, User } from "./schemas";
import { getSupabaseServer, isSupabaseConfigured } from "@/lib/supabase";

export type { User } from "./schemas";

export const TRIAL_DAYS = 3;

/** Fields clients must never be able to invent or extend. */
const BILLING_FIELDS = [
  "trial_started_at",
  "trial_expire_at",
  "trial_used",
  "subscription_status",
  "subscription_plan",
  "subscription_started_at",
  "subscription_expire_at",
  "account_status",
  "google_user_id",
  "created_at",
  "id",
] as const;

const users = new Map<string, User>();

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    google_user_id: String(row.google_user_id),
    email: String(row.email),
    name: String(row.name ?? ""),
    profile_image: String(row.profile_image ?? ""),
    created_at: String(row.created_at),
    trial_started_at: String(row.trial_started_at),
    trial_expire_at: String(row.trial_expire_at),
    trial_used: Boolean(row.trial_used),
    subscription_status: row.subscription_status as User["subscription_status"],
    subscription_plan: (row.subscription_plan as User["subscription_plan"]) ?? null,
    subscription_started_at: row.subscription_started_at
      ? String(row.subscription_started_at)
      : null,
    subscription_expire_at: row.subscription_expire_at
      ? String(row.subscription_expire_at)
      : null,
    account_status: row.account_status as AccountStatus,
  };
}

/** Server-only trial clock for a brand-new Google account. */
export function buildNewTrialFields(now = new Date()) {
  const trialExpire = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return {
    created_at: now.toISOString(),
    trial_started_at: now.toISOString(),
    trial_expire_at: trialExpire.toISOString(),
    trial_used: true as const,
    subscription_status: "trial" as const,
    subscription_plan: "free_trial" as const,
    subscription_started_at: null,
    subscription_expire_at: null,
    account_status: "active" as const,
  };
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  getClient();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseServer()
        .from("users")
        .select("*")
        .eq("google_user_id", googleId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const user = rowToUser(data);
        users.set(user.id, user);
        return user;
      }
      return null;
    } catch (err) {
      console.error("findUserByGoogleId (supabase):", err);
    }
  }

  for (const u of users.values()) if (u.google_user_id === googleId) return u;

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

export async function findUserById(id: string): Promise<User | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseServer()
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const user = rowToUser(data);
        users.set(user.id, user);
        return user;
      }
    } catch (err) {
      console.error("findUserById (supabase):", err);
    }
  }
  return users.get(id) ?? null;
}

/**
 * Ensures the signed-in Google user exists in Supabase.
 * Trial dates always come from the DB (or a fresh server clock) — never from the client session.
 */
export async function ensureUserRecord(user: User): Promise<User> {
  const existing = await findUserById(user.id);
  if (existing) return reconcileUserAccess(existing);

  if (!isSupabaseConfigured()) {
    return reconcileUserAccess(user);
  }

  const byGoogle = await findUserByGoogleId(user.google_user_id);
  if (byGoogle) {
    users.set(byGoogle.id, byGoogle);
    return reconcileUserAccess(byGoogle);
  }

  // First time this Google id is seen on the server — bind a new 3-day trial (ignore client dates).
  const trial = buildNewTrialFields();
  const insertRow = {
    id: user.id,
    google_user_id: user.google_user_id,
    email: user.email,
    name: user.name,
    profile_image: user.profile_image,
    ...trial,
  };

  const { error } = await getSupabaseServer().from("users").insert(insertRow);

  if (error) {
    // Race: another request inserted the same google_user_id
    const retryByGoogle = await findUserByGoogleId(user.google_user_id);
    if (retryByGoogle) return reconcileUserAccess(retryByGoogle);
    const retry = await findUserById(user.id);
    if (retry) return reconcileUserAccess(retry);
    throw new Error(
      `Could not save your account to the database: ${error.message}. Sign out and sign in again.`,
    );
  }

  await getSupabaseServer()
    .from("user_automation")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  const created = rowToUser(insertRow as unknown as Record<string, unknown>);
  users.set(created.id, created);
  return created;
}

export async function createUser(input: {
  google_user_id: string;
  email: string;
  name: string;
  profile_image: string;
}): Promise<User> {
  getClient();

  const existing = await findUserByGoogleId(input.google_user_id);
  if (existing) {
    // Returning Google account — never reset trial. Only refresh profile.
    return (
      (await updateUserProfile(existing.id, {
        email: input.email,
        name: input.name,
        profile_image: input.profile_image,
      })) ?? existing
    );
  }

  const trial = buildNewTrialFields();
  const payload = {
    google_user_id: input.google_user_id,
    email: input.email,
    name: input.name,
    profile_image: input.profile_image,
    ...trial,
  };

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseServer()
        .from("users")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        // Unique violation → fetch the winning row (same Google / email)
        const again = await findUserByGoogleId(input.google_user_id);
        if (again) return again;
        throw error;
      }
      const user = rowToUser(data);
      users.set(user.id, user);
      await getSupabaseServer()
        .from("user_automation")
        .upsert({ user_id: user.id }, { onConflict: "user_id" });
      return user;
    } catch (err) {
      console.error("createUser (supabase):", err);
      throw err;
    }
  }

  const user: User = { id: crypto.randomUUID(), ...payload };
  users.set(user.id, user);
  return user;
}

/** Profile-only updates (safe for login/session refresh). */
export async function updateUserProfile(
  id: string,
  patch: Partial<Pick<User, "email" | "name" | "profile_image">>,
): Promise<User | null> {
  return updateUser(id, patch, { allowBillingFields: false });
}

/**
 * Internal update. Billing/trial fields require allowBillingFields (server-only callers).
 */
export async function updateUser(
  id: string,
  patch: Partial<User>,
  options: { allowBillingFields?: boolean } = {},
): Promise<User | null> {
  const safePatch: Record<string, unknown> = { ...patch };
  delete safePatch.id;

  if (!options.allowBillingFields) {
    for (const key of BILLING_FIELDS) {
      delete safePatch[key];
    }
  }

  if (Object.keys(safePatch).length === 0) {
    return findUserById(id);
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseServer()
        .from("users")
        .update(safePatch)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const user = rowToUser(data);
        users.set(user.id, user);
        return user;
      }
    } catch (err) {
      console.error("updateUser (supabase):", err);
    }
  }

  const current = users.get(id);
  if (!current) return null;
  const next = { ...current, ...safePatch } as User;
  users.set(id, next);
  return next;
}

export async function deleteUser(id: string): Promise<void> {
  await updateUser(id, { account_status: "deleted" as AccountStatus }, { allowBillingFields: true });
}

/**
 * Persist expired status when clocks say so (DB timestamps only).
 * Does not extend or reset trial_expire_at.
 */
export async function reconcileUserAccess(user: User): Promise<User> {
  if (user.account_status !== "active") return user;

  // Paid plan still valid
  if (user.subscription_status === "active") {
    const exp = user.subscription_expire_at
      ? new Date(user.subscription_expire_at).getTime()
      : Number.POSITIVE_INFINITY;
    if (exp >= Date.now()) return user;
    const updated = await updateUser(
      user.id,
      { subscription_status: "expired" },
      { allowBillingFields: true },
    );
    return updated ?? { ...user, subscription_status: "expired" };
  }

  // Explicit cancel → no status flip back to trial
  if (user.subscription_status === "cancelled") return user;

  const trialMsLeft = new Date(user.trial_expire_at).getTime() - Date.now();
  if (trialMsLeft > 0) {
    if (user.subscription_status !== "trial") {
      const updated = await updateUser(
        user.id,
        { subscription_status: "trial", subscription_plan: "free_trial" },
        { allowBillingFields: true },
      );
      return updated ?? { ...user, subscription_status: "trial", subscription_plan: "free_trial" };
    }
    return user;
  }

  if (user.subscription_status !== "expired") {
    const updated = await updateUser(
      user.id,
      { subscription_status: "expired" },
      { allowBillingFields: true },
    );
    return updated ?? { ...user, subscription_status: "expired" };
  }

  return user;
}

/**
 * Trial is active while within trial_expire_at.
 * Dates are the anti-fraud clock (immutable after signup).
 */
export function checkTrialStatus(user: User): { active: boolean; daysRemaining: number } {
  const expire = new Date(user.trial_expire_at).getTime();
  const now = Date.now();
  const msLeft = expire - now;
  const days = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const withinWindow = msLeft > 0;
  const paidActive =
    user.subscription_status === "active" &&
    (!user.subscription_expire_at || new Date(user.subscription_expire_at).getTime() > now);
  const cancelled = user.subscription_status === "cancelled";
  return {
    active: withinWindow && !paidActive && !cancelled && user.account_status === "active",
    daysRemaining: withinWindow ? days : 0,
  };
}

export function checkSubscriptionStatus(user: User): SubscriptionStatus {
  if (user.account_status !== "active") return "expired";

  const paidExp = user.subscription_expire_at
    ? new Date(user.subscription_expire_at).getTime()
    : 0;
  const paidActive = paidExp > Date.now();

  if (paidActive) {
    // Still in paid window — cancelled means "won't renew" but access continues
    if (user.subscription_status === "cancelled") return "cancelled";
    return "active";
  }

  if (user.subscription_status === "cancelled") return "cancelled";

  const trialExpire = new Date(user.trial_expire_at).getTime();
  if (trialExpire > Date.now() && user.subscription_status !== "active") {
    return "trial";
  }

  return "expired";
}
