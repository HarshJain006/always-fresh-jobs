/**
 * Call protected cron HTTP endpoints (Pi worker + Netlify scheduled functions).
 */

export type CronInvokeResult = {
  ok: boolean;
  status: number;
  path: string;
  payload: Record<string, unknown> | null;
  body: string;
};

function cronBaseUrl(): string {
  return (
    process.env.URL ||
    process.env.DEPLOY_URL ||
    process.env.VITE_APP_URL ||
    "https://dailyresume.in"
  ).replace(/\/$/, "");
}

export async function invokeCronEndpoint(
  path: string,
  options?: { method?: "GET" | "POST"; timeoutMs?: number },
): Promise<CronInvokeResult> {
  const secret = process.env.CRON_SECRET?.trim();
  const method = options?.method ?? "POST";
  const timeoutMs = options?.timeoutMs ?? 25_000;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!secret) {
    return {
      ok: false,
      status: 0,
      path: normalizedPath,
      payload: null,
      body: "CRON_SECRET is not set",
    };
  }

  try {
    const res = await fetch(`${cronBaseUrl()}${normalizedPath}`, {
      method,
      headers: { "x-cron-secret": secret },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text().catch(() => "");
    let payload: Record<string, unknown> | null = null;
    try {
      payload = body ? (JSON.parse(body) as Record<string, unknown>) : null;
    } catch {
      payload = null;
    }

    const warning =
      typeof payload?.warning === "string" ? payload.warning : undefined;
    const serverOk = payload?.ok !== false;
    const ok = res.ok && serverOk && !warning;

    return { ok, status: res.status, path: normalizedPath, payload, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      path: normalizedPath,
      payload: null,
      body: message,
    };
  }
}
