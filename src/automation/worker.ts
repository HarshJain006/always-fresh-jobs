/**
 * Automation worker — uses tested Selenium Naukri backend.
 * Server/worker-only. Do not import from React components.
 */

import { runNaukriJob } from "./selenium/runNaukriJob";
import { saveLog } from "./logs";
import { toUserFacingActivityMessage } from "./activityMessage";
import { getUserAutomation, saveUserAutomation } from "@/database/userAutomation";
import { decryptData, isEncryptedSecret } from "@/security/encryption";
import { getResumePath } from "@/storage/storage";
import type { PlatformId } from "@/database/schemas";
import { getAuthoritativeAccess } from "@/security/accessControl";

export interface UserRunResult {
  userId: string;
  platform: PlatformId;
  ok: boolean;
  message: string;
  durationMs: number;
}

export interface RunOptions {
  /** Defaults to true (SaaS). */
  headless?: boolean;
  updatePdf?: boolean;
}

async function finish(
  userId: string,
  platform: PlatformId,
  ok: boolean,
  message: string,
  started: number,
  writeLog = true,
): Promise<UserRunResult> {
  const userMessage = toUserFacingActivityMessage(message, ok);
  if (writeLog) {
    await saveLog({ userId, platform, ok, message: userMessage });
  }
  return { userId, platform, ok, message: userMessage, durationMs: Date.now() - started };
}

export async function runPlatformForUser(
  userId: string,
  platform: PlatformId = "naukri",
  options: RunOptions = {},
): Promise<UserRunResult> {
  const started = Date.now();

  // Only run for users who explicitly started automation
  const record = await getUserAutomation(userId);
  if (record.automationState !== "running") {
    const message = "Skipped — automation is not active for this account.";
    // Do not pollute Recent activity for idle/paused accounts with stale queue jobs
    return finish(userId, platform, false, message, started, false);
  }

  // Server-side subscription gate (cannot be bypassed via localStorage / UI)
  try {
    const access = await getAuthoritativeAccess(userId);
    if (!access.allowed) {
      const message =
        access.reason === "suspended"
          ? "Account suspended — automation blocked"
          : "Your plan has ended — renew to keep daily refreshes running";
      return finish(userId, platform, false, message, started);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Subscription check failed";
    return finish(userId, platform, false, message, started);
  }

  if (platform !== "naukri") {
    return finish(userId, platform, false, `${platform} is not available yet`, started);
  }

  if (!record.credentials) {
    return finish(userId, platform, false, "No Naukri credentials saved", started);
  }

  // Never trust DB-stored resume.path as a filesystem path (path traversal risk)
  const resumePath = await getResumePath(userId);
  if (!resumePath) {
    return finish(userId, platform, false, "No resume uploaded", started);
  }

  let password = record.credentials.password;
  if (!isEncryptedSecret(password)) {
    return finish(
      userId,
      platform,
      false,
      "Stored password is not encrypted — re-save Naukri credentials.",
      started,
    );
  }
  try {
    password = await decryptData(password);
  } catch {
    return finish(
      userId,
      platform,
      false,
      "Could not decrypt Naukri password — re-save credentials.",
      started,
    );
  }

  const result = await runNaukriJob({
    username: record.credentials.username || record.credentials.email,
    password,
    mobile: record.credentials.phone.replace(/\s+/g, ""),
    resumePath,
    headless: options.headless ?? true,
    updatePdf: options.updatePdf ?? true,
  });

  const userMessage = toUserFacingActivityMessage(result.message, result.ok);
  await saveLog({
    userId,
    platform,
    ok: result.ok,
    message: userMessage,
  });

  const platforms = record.platforms.map((p) =>
    p.id === "naukri"
      ? {
          ...p,
          last: result.ok ? new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : p.last,
        }
      : p,
  );

  await saveUserAutomation({
    ...record,
    platforms,
    lastRunAt: new Date().toISOString(),
  });

  return {
    userId,
    platform,
    ok: result.ok,
    message: userMessage,
    durationMs: Date.now() - started,
  };
}

export async function runBatch(userIds: string[], concurrency = 1): Promise<UserRunResult[]> {
  const results: UserRunResult[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(userIds.length, 1)) }, async () => {
    while (cursor < userIds.length) {
      const idx = cursor++;
      results[idx] = await runPlatformForUser(userIds[idx], "naukri");
    }
  });
  await Promise.all(workers);
  return results;
}

export async function shutdown(): Promise<void> {
  // Selenium tears down per-run; nothing global to close.
}
