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
 * - Before free trial ends: emails at 3, 2, and 1 calendar days left
 * - After trial ends: up to 5 win-back emails, every 2 days
 * - After subscription ends: up to 5 win-back emails, every 2 days
 * - Before subscription ends: warnings at 7, 3, 1, and 0 days left
 */
export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const reminders = await runReminderSweep();
          const status = reminders.ok ? 200 : 503;
          return Response.json(reminders, { status });
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
          const status = reminders.ok ? 200 : 503;
          return Response.json(reminders, { status });
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
