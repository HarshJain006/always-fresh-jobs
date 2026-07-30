import { createFileRoute } from "@tanstack/react-router";
import {
  enqueueDailyJobsForEligibleUsers,
  isWithinDynamicEnqueueWindow,
  planTodaysEnqueue,
} from "@/queue/enqueueDaily";
import { isProductionRuntime } from "@/lib/production";
import { runReminderSweep } from "@/notifications/reminderEmails";

/**
 * Netlify / external cron: enqueue daily jobs into Supabase (no Selenium).
 * Requires CRON_SECRET — fails closed if unset.
 *
 * Prefer the Pi worker for dynamic scheduling. This endpoint is a backup:
 * GET only enqueues inside today's computed window; POST always enqueues.
 */
function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return Response.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 },
    );
  }
  const header = request.headers.get("x-cron-secret");
  if (header !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/cron/daily-refresh")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeCron(request);
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
        const denied = authorizeCron(request);
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
