/**
 * Subscription / free-trial access — server is source of truth.
 * Trial is permanently bound to google_user_id (one 3-day window per Google account).
 * Paid access ends exactly at subscription_expire_at.
 */

import type { User } from "@/database/schemas";
import {
  checkSubscriptionStatus,
  checkTrialStatus,
  findUserById,
  reconcileUserAccess,
} from "@/database/users";
import { getUserAutomation, saveUserAutomation } from "@/database/userAutomation";
import { getPaidDaysRemaining } from "@/payments/subscriptionStatus";

export function canUseAutomation(user: User): boolean {
  if (user.account_status !== "active") return false;
  const status = checkSubscriptionStatus(user);
  if (status === "active") return true;
  if (status === "trial") return true;
  // Cancelled but still within paid window
  if (
    status === "cancelled" &&
    user.subscription_expire_at &&
    new Date(user.subscription_expire_at).getTime() > Date.now()
  ) {
    return true;
  }
  return false;
}

export function validateSubscription(user: User): {
  allowed: boolean;
  reason: "active" | "trial" | "expired" | "suspended";
  daysRemaining: number;
  subscriptionExpireAt: string | null;
} {
  if (user.account_status !== "active") {
    return { allowed: false, reason: "suspended", daysRemaining: 0, subscriptionExpireAt: null };
  }

  const status = checkSubscriptionStatus(user);

  // Paid window (active, or cancelled-but-not-yet-expired)
  if (status === "active") {
    return {
      allowed: true,
      reason: "active",
      daysRemaining: getPaidDaysRemaining(user),
      subscriptionExpireAt: user.subscription_expire_at,
    };
  }

  if (
    status === "cancelled" &&
    user.subscription_expire_at &&
    new Date(user.subscription_expire_at).getTime() > Date.now()
  ) {
    return {
      allowed: true,
      reason: "active",
      daysRemaining: getPaidDaysRemaining({ ...user, subscription_status: "active" }),
      subscriptionExpireAt: user.subscription_expire_at,
    };
  }

  if (status === "cancelled") {
    return {
      allowed: false,
      reason: "expired",
      daysRemaining: 0,
      subscriptionExpireAt: user.subscription_expire_at,
    };
  }

  const trial = checkTrialStatus(user);
  if (trial.active) {
    return {
      allowed: true,
      reason: "trial",
      daysRemaining: trial.daysRemaining,
      subscriptionExpireAt: null,
    };
  }

  return {
    allowed: false,
    reason: "expired",
    daysRemaining: 0,
    subscriptionExpireAt: user.subscription_expire_at,
  };
}

export type AccessSnapshot = {
  allowed: boolean;
  reason: "active" | "trial" | "expired" | "suspended";
  daysRemaining: number;
  trialExpireAt: string;
  subscriptionExpireAt: string | null;
  subscriptionStatus: User["subscription_status"];
  subscriptionPlan: User["subscription_plan"];
  user: User;
};

/** Load user from DB, expire stale trial/premium, pause automation if locked out. */
export async function getAuthoritativeAccess(userId: string): Promise<AccessSnapshot> {
  const raw = await findUserById(userId);
  if (!raw) {
    throw new Error("Account not found. Sign out and sign in again with Google.");
  }

  const user = await reconcileUserAccess(raw);
  const access = validateSubscription(user);

  if (!access.allowed) {
    await pauseAutomationIfNeeded(user.id);
  }

  return {
    ...access,
    trialExpireAt: user.trial_expire_at,
    subscriptionExpireAt: access.subscriptionExpireAt,
    subscriptionStatus: user.subscription_status,
    subscriptionPlan: user.subscription_plan,
    user,
  };
}

/** Throws if the account cannot run automation (trial/paid ended or suspended). */
export async function assertAutomationAccess(userId: string): Promise<AccessSnapshot> {
  const access = await getAuthoritativeAccess(userId);
  if (!access.allowed) {
    const msg =
      access.reason === "suspended"
        ? "Your account is suspended."
        : "Your access has ended. Renew your subscription to continue.";
    throw new Error(msg);
  }
  return access;
}

async function pauseAutomationIfNeeded(userId: string): Promise<void> {
  try {
    const record = await getUserAutomation(userId);
    if (record.automationState === "running") {
      await saveUserAutomation({ ...record, userId, automationState: "idle" });
    }
  } catch (err) {
    console.error("pauseAutomationIfNeeded:", err);
  }
}
