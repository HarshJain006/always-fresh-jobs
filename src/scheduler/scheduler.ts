/**
 * Daily scheduler helpers.
 * Heavy Selenium work happens on the RPi via the Supabase job queue.
 * Prefer enqueueDailyJobsForEligibleUsers from @/queue/enqueueDaily.
 */

export {
  enqueueDailyJobsForEligibleUsers as runDailyUpdate,
  enqueueDailyJobsForEligibleUsers,
  isEightAmIstWindow,
  isAfterEightAmIst,
} from "@/queue/enqueueDaily";

/** @deprecated — kept for older imports; now enqueues instead of running Selenium. */
export async function getPendingUserIds(): Promise<string[]> {
  const { listActiveAutomationUsers } = await import("@/database/userAutomation");
  const { getAuthoritativeAccess } = await import("@/security/accessControl");
  const active = await listActiveAutomationUsers();
  const ids: string[] = [];
  for (const u of active) {
    if (!u.credentials || !u.resume) continue;
    const naukri = u.platforms.find((p) => p.id === "naukri");
    if (!naukri?.connected) continue;
    try {
      const access = await getAuthoritativeAccess(u.userId);
      if (access.allowed) ids.push(u.userId);
    } catch {
      /* skip */
    }
  }
  return ids;
}
