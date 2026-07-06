/**
 * Daily scheduler.
 *
 * TODO: Hook into a real cron trigger (e.g. Cloudflare cron, pg_cron webhook,
 * or an external scheduler). For now this exposes callable functions.
 */

import type { User } from "@/database/schemas";
import { canUseAutomation } from "@/security/accessControl";
import { runBatch, type UserRunInput } from "@/automation/worker";

export async function getPendingUsers(): Promise<User[]> {
  // TODO: Query DB for users whose (a) automation is active, (b) subscription/trial valid,
  //       (c) last_run_at is older than 20 hours.
  return [];
}

export async function processUserResume(user: User, jobs: UserRunInput[]): Promise<void> {
  if (!canUseAutomation(user)) return;
  await runBatch(jobs, 4);
}

export async function runDailyUpdate(): Promise<{ processed: number; failed: number }> {
  const users = await getPendingUsers();
  let processed = 0;
  let failed = 0;

  for (const user of users) {
    try {
      // TODO: Assemble UserRunInput[] for the user's connected platforms with decrypted creds.
      await processUserResume(user, []);
      processed++;
    } catch (err) {
      console.error(`Daily update failed for ${user.id}`, err);
      failed++;
    }
  }

  return { processed, failed };
}
