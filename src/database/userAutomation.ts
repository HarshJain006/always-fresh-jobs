/**
 * Per-user automation state — Supabase-backed with optional local .data fallback (dev/Pi only).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { PlatformId } from "./schemas";
import { canUseLocalFilesystem } from "@/lib/runtime";
import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";

export type AutomationStatus = "idle" | "running" | "paused";

export interface StoredCredentials {
  username: string;
  password: string;
  email: string;
  phone: string;
}

export interface UserAutomationRecord {
  userId: string;
  credentials: StoredCredentials | null;
  resume: { name: string; size: string; path: string } | null;
  platforms: {
    id: PlatformId;
    name: string;
    connected: boolean;
    last: string | null;
  }[];
  automationState: AutomationStatus;
  lastRunAt: string | null;
  updatedAt: string;
}

const STORE_DIR = path.join(process.cwd(), ".data", "automation");

function filePath(userId: string): string {
  return path.join(STORE_DIR, `${userId}.json`);
}

function ensureDir() {
  if (!canUseLocalFilesystem()) {
    throw new Error("Local automation storage is unavailable in this environment.");
  }
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

function defaultRecord(userId: string): UserAutomationRecord {
  return {
    userId,
    credentials: null,
    resume: null,
    platforms: [
      { id: "naukri", name: "Naukri", connected: false, last: null },
      { id: "indeed", name: "Indeed", connected: false, last: null },
    ],
    automationState: "idle",
    lastRunAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function rowToRecord(row: Record<string, unknown>): UserAutomationRecord {
  return {
    userId: String(row.user_id),
    credentials: (row.credentials as StoredCredentials | null) ?? null,
    resume: (row.resume as UserAutomationRecord["resume"]) ?? null,
    platforms:
      (row.platforms as UserAutomationRecord["platforms"]) ??
      defaultRecord(String(row.user_id)).platforms,
    automationState: (row.automation_state as AutomationStatus) || "idle",
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function recordToRow(record: UserAutomationRecord) {
  return {
    user_id: record.userId,
    credentials: record.credentials,
    resume: record.resume,
    platforms: record.platforms,
    automation_state: record.automationState,
    last_run_at: record.lastRunAt,
    updated_at: new Date().toISOString(),
  };
}

function readLocal(userId: string): UserAutomationRecord {
  ensureDir();
  const fp = filePath(userId);
  if (!fs.existsSync(fp)) return defaultRecord(userId);
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as UserAutomationRecord;
  } catch {
    return defaultRecord(userId);
  }
}

function writeLocal(record: UserAutomationRecord): UserAutomationRecord {
  ensureDir();
  record.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath(record.userId), JSON.stringify(record, null, 2));
  return record;
}

export async function getUserAutomation(userId: string): Promise<UserAutomationRecord> {
  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("user_automation")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return rowToRecord(data);

    const empty = defaultRecord(userId);
    const { error: upsertErr } = await getSupabaseServer()
      .from("user_automation")
      .upsert(recordToRow(empty), { onConflict: "user_id" });
    if (upsertErr) throw upsertErr;
    return empty;
  }

  if (!canUseLocalFilesystem()) {
    throw new Error(
      "Database is not configured. Set SUPABASE_SERVICE_ROLE_KEY on Netlify.",
    );
  }

  return readLocal(userId);
}

export async function saveUserAutomation(
  record: UserAutomationRecord,
): Promise<UserAutomationRecord> {
  record.updatedAt = new Date().toISOString();

  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("user_automation")
      .upsert(recordToRow(record), { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return rowToRecord(data);
  }

  if (!canUseLocalFilesystem()) {
    throw new Error(
      "Database is not configured. Set SUPABASE_SERVICE_ROLE_KEY on Netlify.",
    );
  }

  return writeLocal(record);
}

export async function listActiveAutomationUsers(): Promise<UserAutomationRecord[]> {
  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("user_automation")
      .select("*")
      .eq("automation_state", "running");
    if (error) throw error;
    return (data ?? []).map((row) => rowToRecord(row));
  }

  if (!canUseLocalFilesystem()) return [];

  ensureDir();
  const files = fs.readdirSync(STORE_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(STORE_DIR, f), "utf8")) as UserAutomationRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is UserAutomationRecord => !!r && r.automationState === "running");
}
