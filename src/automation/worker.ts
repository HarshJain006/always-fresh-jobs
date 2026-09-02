/**
 * Automation worker — uses tested Selenium Naukri backend.
 * Server/worker-only. Do not import from React components.
 */

import { runNaukriJob } from "./selenium/runNaukriJob";
import { saveLog } from "./logs";
import { toUserFacingActivityMessage } from "./activityMessage";
import { notifyCredentialFailure } from "@/notifications/credentialFailureNotify";
import { getUserAutomation, saveUserAutomation } from "@/database/userAutomation";
import { decryptData, isEncryptedSecret } from "@/security/encryption";
import { getResumePath, getResumeFileName } from "@/storage/storage";
import type { PlatformId } from "@/database/schemas";
import { getAuthoritativeAccess } from "@/security/accessControl";
import { shouldWriteUserActivityLog, isCredentialFailureMessage } from "@/queue/jobErrors";
import { startTrialClockIfNeeded } from "@/database/users";

export interface UserRunResult {
  userId: string;
  platform: PlatformId;
  ok: boolean;
  /** Backend / queue message (may include retry detail). */
  message: string;
  durationMs: number;
}

export interface RunOptions {
  /** Defaults to true (SaaS). */
  headless?: boolean;
  /** Backend robustness test — never write dashboard Recent activity. */
  skipUserActivityLog?: boolean;
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
  if (writeLog && shouldWriteUserActivityLog(ok, message) && userMessage) {
    try {
      await saveLog({ userId, platform, ok, message: userMessage });
    } catch (err) {
      console.error(
        `[worker] activity log write failed for user=${userId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { userId, platform, ok, message, durationMs: Date.now() - started };
}

/** After 3 failed attempts — write activity log + send wrong-password email. */
export async function recordFinalCredentialFailure(
  userId: string,
  platform: PlatformId,
  message: string,
): Promise<void> {
  const userMessage = toUserFacingActivityMessage(message, false);
  if (!userMessage || !isCredentialFailureMessage(message, userMessage)) return;

  try {
    const log = await saveLog({ userId, platform, ok: false, message: userMessage });
    await notifyCredentialFailure(userId, log.id, message, userMessage);
  } catch (err) {
    console.error(
      `[worker] final credential failure notify failed for user=${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }
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

  // Ensure trial clock is ticking in Supabase (fixes stuck pending trials that never expire)
  try {
    await startTrialClockIfNeeded(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start free trial";
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
      return finish(userId, platform, false, message, started, false);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Subscription check failed";
    return finish(userId, platform, false, message, started, false);
  }

  if (platform !== "naukri") {
    return finish(userId, platform, false, `${platform} is not available yet`, started, false);
  }

  if (!record.credentials) {
    return finish(userId, platform, false, "No Naukri credentials saved", started, false);
  }

  // Never trust DB-stored resume.path as a filesystem path (path traversal risk)
  const resumePath = await getResumePath(userId);
  if (!resumePath) {
    return finish(userId, platform, false, "No resume uploaded", started, false);
  }

  // Prefer authoritative resumes.file_name over possibly-stale automation JSON
  const storedName = await getResumeFileName(userId);
  const originalFileName =
    storedName ||
    record.resume?.name ||
    undefined;

  let password = record.credentials.password;
  if (!isEncryptedSecret(password)) {
    return finish(
      userId,
      platform,
      false,
      "Stored password is not encrypted — re-save Naukri credentials.",
      started,
      false,
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
      false,
    );
  }

  const result = await runNaukriJob({
    username: record.credentials.username || record.credentials.email,
    password,
    mobile: record.credentials.phone.replace(/\s+/g, ""),
    resumePath,
    originalFileName,
    headless: options.headless ?? true,
  });

  // Frontend activity: log success only; wrong-password logged after 3 failed attempts (queue-worker)
  if (
    !options.skipUserActivityLog &&
    result.ok &&
    shouldWriteUserActivityLog(result.ok, result.message)
  ) {
    const userMessage = toUserFacingActivityMessage(result.message, result.ok);
    if (userMessage) {
      try {
        await saveLog({
          userId,
          platform,
          ok: result.ok,
          message: userMessage,
        });
      } catch (err) {
        console.error(
          `[worker] activity log write failed for user=${userId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // Don't bump "last refresh" UI timestamp during silent backend test runs
  try {
    if (!options.skipUserActivityLog) {
      const platforms = record.platforms.map((p) =>
        p.id === "naukri"
          ? {
              ...p,
              last: result.ok
                ? new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                : p.last,
            }
          : p,
      );

      await saveUserAutomation({
        ...record,
        platforms,
        lastRunAt: new Date().toISOString(),
      });
    } else if (result.ok) {
      await saveUserAutomation({
        ...record,
        lastRunAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(
      `[worker] saveUserAutomation failed for user=${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }

  return {
    userId,
    platform,
    ok: result.ok,
    message: result.message,
    durationMs: Date.now() - started,
  };
}

export async function runBatch(userIds: string[], concurrency = 1): Promise<UserRunResult[]> {
  const results: UserRunResult[] = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(userIds.length, 1)) },
    async () => {
      while (cursor < userIds.length) {
        const idx = cursor++;
        results[idx] = await runPlatformForUser(userIds[idx], "naukri");
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function shutdown(): Promise<void> {
  // Selenium tears down per-run; nothing global to close.
}
