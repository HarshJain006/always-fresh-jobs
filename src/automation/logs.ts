/**
 * Automation log store — Supabase primary (dashboard Recent activity).
 * Local JSON fallback + pending outbox so Pi DNS blips don't lose success logs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AutomationLog, PlatformId } from "@/database/schemas";
import { canUseLocalFilesystem } from "@/lib/runtime";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";
import { isTransientFetchError, withRetry } from "@/lib/retry";

const LOG_FILE = path.join(process.cwd(), ".data", "logs.json");
const PENDING_FILE = path.join(process.cwd(), ".data", "logs-pending.json");

function readJsonArray<T>(file: string): T[] {
  if (!canUseLocalFilesystem()) return [];
  try {
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray(file: string, rows: unknown[]) {
  if (!canUseLocalFilesystem()) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}

function readAllLocal(): AutomationLog[] {
  return readJsonArray<AutomationLog>(LOG_FILE);
}

function writeAllLocal(logs: AutomationLog[]) {
  writeJsonArray(LOG_FILE, logs.slice(0, 500));
}

function saveLocal(log: AutomationLog): AutomationLog {
  const logs = readAllLocal();
  logs.unshift(log);
  writeAllLocal(logs);
  return log;
}

function readPending(): AutomationLog[] {
  return readJsonArray<AutomationLog>(PENDING_FILE);
}

function writePending(logs: AutomationLog[]) {
  writeJsonArray(PENDING_FILE, logs.slice(0, 200));
}

function enqueuePending(log: AutomationLog) {
  if (!canUseLocalFilesystem()) return;
  const pending = readPending().filter((p) => p.id !== log.id);
  pending.unshift(log);
  writePending(pending);
}

function removePending(id: string) {
  if (!canUseLocalFilesystem()) return;
  writePending(readPending().filter((p) => p.id !== id));
}

function supabaseErrorMessage(err: unknown): string {
  if (!err) return "unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err && "message" in err) {
    return String((err as { message?: unknown }).message || err);
  }
  return String(err);
}

/** Insert one row into Supabase (no SELECT — avoids post-insert read flakes). */
async function insertLogToSupabase(log: AutomationLog): Promise<void> {
  await withRetry(
    "saveLog.insert",
    async () => {
      const res = await getSupabaseServer().from("automation_logs").insert({
        id: log.id,
        user_id: log.user_id,
        platform: log.platform,
        ok: log.ok,
        message: log.message,
        created_at: log.created_at,
      });
      if (res.error) {
        const msg = res.error.message || "";
        // Idempotent: row already there from a prior partial success
        if (/duplicate|unique|23505/i.test(msg)) return;
        const wrapped = new Error(msg);
        (wrapped as Error & { details?: string }).details = String(
          (res.error as { details?: string }).details || "",
        );
        throw wrapped;
      }
    },
    { attempts: 5, baseDelayMs: 600 },
  );
}

export async function saveLog(input: {
  userId: string;
  platform: PlatformId;
  ok: boolean;
  message: string;
}): Promise<AutomationLog> {
  const log: AutomationLog = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    platform: input.platform,
    ok: input.ok,
    message: input.message,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseServerConfigured()) {
    if (!canUseLocalFilesystem()) {
      throw new Error(
        "Cannot save activity log — set SUPABASE_SERVICE_ROLE_KEY on the worker.",
      );
    }
    return saveLocal(log);
  }

  try {
    await insertLogToSupabase(log);
    removePending(log.id);
    return log;
  } catch (err) {
    console.error(
      `[saveLog] Supabase insert failed for user=${input.userId}:`,
      supabaseErrorMessage(err),
    );
    // Durable outbox — worker flushes when DNS recovers so the dashboard catches up
    enqueuePending(log);
    if (canUseLocalFilesystem()) {
      console.warn(
        `[saveLog] Queued pending outbox + local mirror for user=${input.userId} (will retry to Supabase)`,
      );
      return saveLocal(log);
    }
    throw err instanceof Error ? err : new Error(supabaseErrorMessage(err));
  }
}

/**
 * Push any locally-queued activity logs to Supabase (call from Pi worker loop).
 * Returns how many rows were successfully synced.
 */
export async function flushPendingActivityLogs(): Promise<{
  attempted: number;
  synced: number;
  remaining: number;
}> {
  if (!isSupabaseServerConfigured() || !canUseLocalFilesystem()) {
    return { attempted: 0, synced: 0, remaining: 0 };
  }

  const pending = readPending();
  if (pending.length === 0) return { attempted: 0, synced: 0, remaining: 0 };

  let synced = 0;
  const remaining: AutomationLog[] = [];

  for (let i = 0; i < pending.length; i++) {
    const log = pending[i];
    try {
      await insertLogToSupabase(log);
      synced++;
    } catch (err) {
      console.warn(
        `[saveLog] flush still pending id=${log.id}:`,
        supabaseErrorMessage(err),
      );
      // Keep this row + everything not yet tried
      remaining.push(...pending.slice(i));
      break;
    }
  }

  writePending(remaining);

  if (synced > 0) {
    console.log(
      `[saveLog] Flushed ${synced} pending activity log(s) to Supabase (${remaining.length} still queued).`,
    );
  }

  return { attempted: pending.length, synced, remaining: remaining.length };
}

export async function getUserLogs(userId: string, limit = 50): Promise<AutomationLog[]> {
  if (isSupabaseServerConfigured()) {
    try {
      const data = await withRetry(
        "getUserLogs",
        async () => {
          const { data, error } = await getSupabaseServer()
            .from("automation_logs")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (error) throw new Error(error.message);
          return data ?? [];
        },
        { attempts: 3, baseDelayMs: 400 },
      );

      return data.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        platform: row.platform,
        ok: row.ok,
        message: row.message,
        created_at: row.created_at,
      }));
    } catch (err) {
      console.error(
        `[getUserLogs] Supabase read failed for user=${userId}:`,
        err instanceof Error ? err.message : err,
      );
      if (!canUseLocalFilesystem()) throw err;
    }
  }

  return readAllLocal()
    .filter((l) => l.user_id === userId)
    .slice(0, limit);
}
