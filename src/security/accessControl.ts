import type { User } from "@/database/schemas";
import { checkSubscriptionStatus, checkTrialStatus } from "@/database/users";

export function canUseAutomation(user: User): boolean {
  if (user.account_status !== "active") return false;
  const status = checkSubscriptionStatus(user);
  if (status === "active") return true;
  const trial = checkTrialStatus(user);
  return trial.active;
}

export function validateSubscription(user: User): {
  allowed: boolean;
  reason: "active" | "trial" | "expired" | "suspended";
} {
  if (user.account_status !== "active") return { allowed: false, reason: "suspended" };
  const status = checkSubscriptionStatus(user);
  if (status === "active") return { allowed: true, reason: "active" };
  const trial = checkTrialStatus(user);
  if (trial.active) return { allowed: true, reason: "trial" };
  return { allowed: false, reason: "expired" };
}
