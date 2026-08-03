/**
 * Automation worker — uses tested Selenium Naukri backend.
 * Server/worker-only. Do not import from React components.
 */

import { runNaukriJob } from "./selenium/runNaukriJob";
import { saveLog } from "./logs";
import { toUserFacingActivityMessage } from "./activityMessage";
import { getUserAutomation, saveUserAutomation } from "@/database/userAutomation";
import { decryptData, isEncryptedSecret } from "@/security/encryption";
import { getResumePath, getResumeFileName } from "@/storage/storage";
import type { PlatformId } from "@/database/schemas";
import { getAuthoritativeAccess } from "@/security/accessControl";
import { shouldWriteUserActivityLog } from "@/queue/jobErrors";

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
    await saveLog({ userId, platform, ok, message: userMessage });
  }
  // Keep raw backend message for queue retry policy; UI uses userMessage only when logged
  return { userId, platform, ok, message, durationMs: Date.now() - started };
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

  // Frontend activity: only success or wrong password (skipped entirely for backend test runs)
  if (
    !options.skipUserActivityLog &&
    shouldWriteUserActivityLog(result.ok, result.message)
  ) {
    const userMessage = toUserFacingActivityMessage(result.message, result.ok);
    if (userMessage) {
      await saveLog({
        userId,
        platform,
        ok: result.ok,
        message: userMessage,
      });
    }
  }

  // Don't bump "last refresh" UI timestamp during silent backend test runs
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
    // Still record lastRunAt for ops, but keep platform "last" unchanged for cleaner UX
    await saveUserAutomation({
      ...record,
      lastRunAt: new Date().toISOString(),
    });
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
