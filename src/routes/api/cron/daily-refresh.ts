import { createFileRoute } from "@tanstack/react-router";
import {
  enqueueDailyJobsForEligibleUsers,
  isWithinDynamicEnqueueWindow,
  planTodaysEnqueue,
} from "@/queue/enqueueDaily";
import { isProductionRuntime } from "@/lib/production";
import { authorizeCronRequest } from "@/lib/cronAuth";
import { runReminderSweep } from "@/notifications/reminderEmails";

/**
 * Netlify / external cron: enqueue daily jobs into Supabase (no Selenium).
 * Requires CRON_SECRET — fails closed if unset.
 *
 * Prefer the Pi worker for dynamic scheduling. This endpoint is a backup:
 * GET only enqueues inside today's computed window; POST always enqueues.
 *
 * For expiry reminder emails, use /api/cron/reminders (daily).
 */

export const Route = createFileRoute("/api/cron/daily-refresh")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const force = !isProductionRuntime() && url.searchParams.get("force") === "1";
        const plan = await planTodaysEnqueue();

        if (!force && !isWithinDynamicEnqueueWindow(plan)) {
          const reminders = await runReminderSweep().catch((err) => {
            console.error("[mail] reminder sweep failed:", err);
            return { sent: 0, attempted: 0 };
          });
          return Response.json({
            skipped: true,
            reason: `Outside dynamic window (start ${plan.startLabel} IST, finish by ${plan.finishLabel}).`,
            plan,
            reminders,
          });
        }

        const result = await enqueueDailyJobsForEligibleUsers();
        const reminders = await runReminderSweep().catch((err) => {
          console.error("[mail] reminder sweep failed:", err);
          return { sent: 0, attempted: 0 };
        });
        return Response.json({ ok: true, queued: true, plan, ...result, reminders });
      },
      POST: async ({ request }) => {
        const denied = authorizeCronRequest(request);
        if (denied) return denied;
        const plan = await planTodaysEnqueue();
        const result = await enqueueDailyJobsForEligibleUsers();
        const reminders = await runReminderSweep().catch((err) => {
          console.error("[mail] reminder sweep failed:", err);
          return { sent: 0, attempted: 0 };
        });
        return Response.json({ ok: true, queued: true, plan, ...result, reminders });
      },
    },
  },
});
