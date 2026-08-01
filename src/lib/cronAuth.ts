/**
 * Shared auth for Netlify / external cron HTTP endpoints.
 */

export function authorizeCronRequest(request: Request): Response | null {
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
