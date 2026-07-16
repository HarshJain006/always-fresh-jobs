/**
 * Automation worker — uses tested Selenium Naukri backend.
 * Server/worker-only. Do not import from React components.
 */

import { runNaukriJob } from "./selenium/runNaukriJob";
import { saveLog } from "./logs";
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

export async function runPlatformForUser(
  userId: string,
  platform: PlatformId = "naukri",
  options: RunOptions = {},
): Promise<UserRunResult> {
  const started = Date.now();

  // Server-side subscription gate (cannot be bypassed via localStorage / UI)
  try {
    const access = await getAuthoritativeAccess(userId);
    if (!access.allowed) {
      const message =
        access.reason === "suspended"
          ? "Account suspended — automation blocked"
          : "Free trial ended — upgrade required to run automation";
      await saveLog({ userId, platform, ok: false, message });
      return { userId, platform, ok: false, message, durationMs: Date.now() - started };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Subscription check failed";
    await saveLog({ userId, platform, ok: false, message });
    return { userId, platform, ok: false, message, durationMs: Date.now() - started };
  }

  if (platform !== "naukri") {
    const message = `${platform} is not available yet`;
    await saveLog({ userId, platform, ok: false, message });
    return { userId, platform, ok: false, message, durationMs: Date.now() - started };
  }

  const record = await getUserAutomation(userId);
  if (!record.credentials) {
    const message = "No Naukri credentials saved";
    await saveLog({ userId, platform, ok: false, message });
    return { userId, platform, ok: false, message, durationMs: Date.now() - started };
  }

  // Never trust DB-stored resume.path as a filesystem path (path traversal risk)
  const resumePath = await getResumePath(userId);
  if (!resumePath) {
    const message = "No resume uploaded";
    await saveLog({ userId, platform, ok: false, message });
    return { userId, platform, ok: false, message, durationMs: Date.now() - started };
  }

  let password = record.credentials.password;
  if (!isEncryptedSecret(password)) {
    const message = "Stored password is not encrypted — re-save Naukri credentials.";
    await saveLog({ userId, platform, ok: false, message });
    return { userId, platform, ok: false, message, durationMs: Date.now() - started };
  }
  try {
    password = await decryptData(password);
  } catch {
    const message = "Could not decrypt Naukri password — re-save credentials.";
    await saveLog({ userId, platform, ok: false, message });
    return { userId, platform, ok: false, message, durationMs: Date.now() - started };
  }

  const result = await runNaukriJob({
    username: record.credentials.username || record.credentials.email,
    password,
    mobile: record.credentials.phone.replace(/\s+/g, ""),
    resumePath,
    headless: options.headless ?? true,
    updatePdf: options.updatePdf ?? true,
  });

  await saveLog({
    userId,
    platform,
    ok: result.ok,
    message: result.message,
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
    message: result.message,
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
