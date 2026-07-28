/**
 * Automation log store — Supabase primary (dashboard Recent activity).
 * Local JSON fallback only on Pi/dev when Supabase is unavailable.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AutomationLog, PlatformId } from "@/database/schemas";
import { canUseLocalFilesystem } from "@/lib/runtime";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";

const LOG_FILE = path.join(process.cwd(), ".data", "logs.json");

function readAllLocal(): AutomationLog[] {
  if (!canUseLocalFilesystem()) return [];
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")) as AutomationLog[];
  } catch {
    return [];
  }
}

function writeAllLocal(logs: AutomationLog[]) {
  if (!canUseLocalFilesystem()) return;
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(0, 500), null, 2));
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

  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("automation_logs")
      .insert({
        id: log.id,
        user_id: log.user_id,
        platform: log.platform,
        ok: log.ok,
        message: log.message,
        created_at: log.created_at,
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      user_id: data.user_id,
      platform: data.platform,
      ok: data.ok,
      message: data.message,
      created_at: data.created_at,
    };
  }

  if (!canUseLocalFilesystem()) {
    throw new Error(
      "Cannot save activity log — set SUPABASE_SERVICE_ROLE_KEY on the worker.",
    );
  }

  const logs = readAllLocal();
  logs.unshift(log);
  writeAllLocal(logs);
  return log;
}

export async function getUserLogs(userId: string, limit = 50): Promise<AutomationLog[]> {
  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("automation_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      platform: row.platform,
      ok: row.ok,
      message: row.message,
      created_at: row.created_at,
    }));
  }

  return readAllLocal()
    .filter((l) => l.user_id === userId)
    .slice(0, limit);
}
