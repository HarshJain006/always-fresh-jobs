/**
 * Server functions for dashboard ↔ automation backend.
 * Auth: signed app session (minted after verified Google ID token). Never trust client user IDs alone.
 */

import { createServerFn } from "@tanstack/react-start";
import { encryptData } from "@/security/encryption";
import { requireSessionUser } from "@/security/serverAuth";
import { uploadResume as storeResume, getResumePath, deleteResume, resumeExists } from "@/storage/storage";
import {
  getUserAutomation,
  saveUserAutomation,
  type AutomationStatus,
  type StoredCredentials,
} from "@/database/userAutomation";
import { getUserLogs } from "@/automation/logs";
import { toUserFacingActivityMessage } from "@/automation/activityMessage";
import type { PlatformId } from "@/database/schemas";
import { assertAutomationAccess, getAuthoritativeAccess } from "@/security/accessControl";
import { startTrialClockIfNeeded } from "@/database/users";
import { enqueueJob, getRecentJobsForUser, cancelPendingJobsForUser } from "@/queue/jobs";

type AuthInput = { sessionToken: string };

export const getDashboardState = createServerFn({ method: "GET" })
  .inputValidator((data: AuthInput) => data)
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const userId = dbUser.id;
    const access = await getAuthoritativeAccess(userId);
    const record = await getUserAutomation(userId);
    const logs = await getUserLogs(userId, 20);
    const jobs = await getRecentJobsForUser(userId, 8).catch(() => []);
    return {
      userId,
      user: access.user,
      access: {
        allowed: access.allowed,
        reason: access.reason,
        daysRemaining: access.daysRemaining,
        trialPending: access.trialPending,
        trialExpireAt: access.trialExpireAt,
        subscriptionExpireAt: access.subscriptionExpireAt,
        subscriptionStatus: access.subscriptionStatus,
        subscriptionPlan: access.subscriptionPlan,
      },
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.job_type,
        status: j.status,
        message: j.result_message || j.error,
        createdAt: j.created_at,
      })),
      resume: record.resume ? { name: record.resume.name, size: record.resume.size } : null,
      credentialsSaved: !!record.credentials,
      credentials: record.credentials
        ? {
            username: record.credentials.username,
            email: record.credentials.email,
            phone: record.credentials.phone,
            password: "",
          }
        : { username: "", email: "", phone: "", password: "" },
      platforms: record.platforms,
      automationState: record.automationState,
      lastRunAt: record.lastRunAt,
      logs: logs
        .map((l) => {
          const text = toUserFacingActivityMessage(l.message, l.ok);
          return {
            id: l.id,
            ok: l.ok,
            text,
            time: new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            ts: new Date(l.created_at).getTime(),
          };
        })
        // Hide retry/infra noise and empty rows (only success + wrong-password)
        .filter((l) => Boolean(l.text)),
    };
  });

export const saveNaukriCredentials = createServerFn({ method: "POST" })
  .inputValidator((data: AuthInput & { credentials: StoredCredentials }) => data)
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const userId = dbUser.id;
    const { credentials } = data;
    if (!credentials.username || !credentials.phone) {
      throw new Error("Username and phone are required");
    }
    const record = await getUserAutomation(userId);
    const existing = record.credentials;
    if (!credentials.password && !existing?.password) {
      throw new Error("Password is required");
    }
    const encryptedPassword = credentials.password
      ? await encryptData(credentials.password)
      : existing!.password;
    await saveUserAutomation({
      ...record,
      credentials: {
        username: credentials.username.trim(),
        email: (credentials.email || credentials.username).trim(),
        phone: credentials.phone.replace(/\s+/g, ""),
        password: encryptedPassword,
      },
    });
    return { ok: true };
  });

export const uploadUserResume = createServerFn({ method: "POST" })
  .inputValidator(
    (data: AuthInput & { fileName: string; contentType: string; dataBase64: string }) => data,
  )
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const userId = dbUser.id;

    const stored = await storeResume(userId, {
      name: data.fileName,
      type: data.contentType,
      dataBase64: data.dataBase64,
    });
    const record = await getUserAutomation(userId);
    await saveUserAutomation({
      ...record,
      userId,
      resume: {
        name: stored.fileName,
        size: `${(stored.size / 1024).toFixed(0)} KB`,
        // Canonical marker only — worker must use getResumePath(userId), never this string as FS input
        path: `supabase:${userId}/latest.pdf`,
      },
    });
    return {
      userId,
      name: stored.fileName,
      size: `${(stored.size / 1024).toFixed(0)} KB`,
      replaced: true,
      compressed: stored.compressed ?? false,
      savedBytes: stored.originalBytes ? Math.max(0, stored.originalBytes - stored.size) : 0,
    };
  });

export const deleteUserResume = createServerFn({ method: "POST" })
  .inputValidator((data: AuthInput) => data)
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const userId = dbUser.id;
    await deleteResume(userId);
    const record = await getUserAutomation(userId);
    await saveUserAutomation({ ...record, userId, resume: null });
    return { ok: true, userId };
  });

export const setPlatformConnected = createServerFn({ method: "POST" })
  .inputValidator((data: AuthInput & { platformId: PlatformId; connected: boolean }) => data)
  .handler(async ({ data }) => {
    if (data.platformId === "indeed") {
      throw new Error("Indeed is coming soon");
    }
    const dbUser = await requireSessionUser(data.sessionToken);
    const userId = dbUser.id;
    const record = await getUserAutomation(userId);
    if (data.connected && !record.credentials) {
      throw new Error("Save Naukri credentials before connecting");
    }
    if (data.connected) {
      const hasResume = record.resume ? true : await resumeExists(userId);
      if (!hasResume) {
        throw new Error("Upload your resume before connecting");
      }
    }
    const platforms = record.platforms.map((p) =>
      p.id === data.platformId
        ? { ...p, connected: data.connected, last: data.connected ? p.last : null }
        : p,
    );
    await saveUserAutomation({ ...record, userId, platforms });
    return { platforms, userId };
  });

export const setAutomationState = createServerFn({ method: "POST" })
  .inputValidator((data: AuthInput & { state: AutomationStatus }) => data)
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    const userId = dbUser.id;
    if (data.state === "running") {
      // Start the 5-day free-trial clock on first Start (once per Google account)
      await startTrialClockIfNeeded(userId);
      await assertAutomationAccess(userId);
    }
    const record = await getUserAutomation(userId);
    if (data.state === "running") {
      if (!record.resume) throw new Error("Upload your resume first");
      if (!record.credentials) throw new Error("Save Naukri credentials first");
      const naukri = record.platforms.find((p) => p.id === "naukri");
      if (!naukri?.connected) throw new Error("Connect Naukri first");
    }
    await saveUserAutomation({ ...record, userId, automationState: data.state });

    // Start = opt into the morning schedule only. Do NOT enqueue immediately
    // (avoids spam runs / activity logs before the daily window).
    if (data.state === "paused" || data.state === "idle") {
      await cancelPendingJobsForUser(userId);
    }

    return { state: data.state, userId };
  });

/** Start an immediate resume refresh (runs on the automation backend). Kept for admin/tests; UI no longer calls it. */
export const runNaukriNow = createServerFn({ method: "POST" })
  .inputValidator((data: AuthInput) => data)
  .handler(async ({ data }) => {
    const dbUser = await requireSessionUser(data.sessionToken);
    await assertAutomationAccess(dbUser.id);
    const q = await enqueueJob({
      userId: dbUser.id,
      jobType: "run_now",
      platform: "naukri",
    });
    return {
      ok: q.ok,
      jobId: q.job?.id ?? null,
      message: "Your resume refresh has started. We'll update your activity when it's done.",
      durationMs: 0,
    };
  });
