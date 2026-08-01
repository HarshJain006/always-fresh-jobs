import { createFileRoute } from "@tanstack/react-router";
import { authorizeCronRequest } from "@/lib/cronAuth";
import { runReminderSweep } from "@/notifications/reminderEmails";

/**
 * Daily reminder cron — trial/subscription expiry emails.
 *
 * Schedule once per day (e.g. 10:00 AM IST):
 *   GET https://dailyresume.in/api/cron/reminders
 *   Header: x-cron-secret: <CRON_SECRET>
 *
 * Rules:
 * - Before free trial ends: emails on second-last day and last day
 * - After trial ends: up to 5 emails, 3 days apart
 * - After subscription ends: up to 5 emails, 3 days apart
 * - Before subscription ends: up to 5 emails, 3 days apart (12/9/6/3/0 days left)
 */
export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const reminders = await runReminderSweep();
          return Response.json({ ok: true, ...reminders });
        } catch (err) {
          console.error("[mail] reminder cron failed:", err);
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          );
        }
      },
      POST: async ({ request }) => {
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const reminders = await runReminderSweep();
          return Response.json({ ok: true, ...reminders });
        } catch (err) {
          console.error("[mail] reminder cron failed:", err);
          return Response.json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
