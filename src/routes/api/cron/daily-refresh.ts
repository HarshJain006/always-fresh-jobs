import { createFileRoute } from "@tanstack/react-router";
import {
  enqueueDailyJobsForEligibleUsers,
  isEightAmIstWindow,
} from "@/queue/enqueueDaily";

/**
 * Netlify / external cron: enqueue daily jobs into Supabase (no Selenium).
 * Requires CRON_SECRET — fails closed if unset.
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
        const force = url.searchParams.get("force") === "1";

        if (!force && !isEightAmIstWindow()) {
          return Response.json({
            skipped: true,
            reason: "Outside 8:00–8:04 AM IST window. Pass ?force=1 (with CRON_SECRET) to enqueue anyway.",
          });
        }

        const result = await enqueueDailyJobsForEligibleUsers();
        return Response.json({ ok: true, queued: true, ...result });
      },
      POST: async ({ request }) => {
        const denied = authorizeCron(request);
        if (denied) return denied;
        const result = await enqueueDailyJobsForEligibleUsers();
        return Response.json({ ok: true, queued: true, ...result });
      },
    },
  },
});
