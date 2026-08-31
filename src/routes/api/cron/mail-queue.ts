import { createFileRoute } from "@tanstack/react-router";
import { authorizeCronRequest } from "@/lib/cronAuth";
import { runMailQueueFlush } from "@/notifications/reminderEmails";

/**
 * Drain queued transactional emails (credential failures, cap overflow).
 * Called by the Pi worker after wrong-password events, or manually for recovery.
 *
 *   POST https://dailyresume.in/api/cron/mail-queue
 *   Header: x-cron-secret: <CRON_SECRET>
 */
export const Route = createFileRoute("/api/cron/mail-queue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const result = await runMailQueueFlush();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[mail] mail-queue cron failed:", err);
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
          const result = await runMailQueueFlush();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[mail] mail-queue cron failed:", err);
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
