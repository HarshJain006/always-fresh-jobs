/**
 * ADDED (ATS Score feature) — ATS check history + free-trial quota tracking.
 *
 * Trial accounts get TRIAL_ATS_LIMIT lifetime checks; paid accounts are unlimited
 * while their subscription is active. Counts are server-side only.
 */

import { getSupabaseServer, isSupabaseServerConfigured } from "@/lib/supabase";

export const TRIAL_ATS_LIMIT = 2;

export interface AtsCheckRow {
  id: string;
  user_id: string;
  score: number;
  file_name: string | null;
  used_job_description: boolean;
  created_at: string;
}

// Fallback store for environments without Supabase (dev only).
const memory = new Map<string, AtsCheckRow[]>();

export async function countAtsChecks(userId: string): Promise<number> {
  if (isSupabaseServerConfigured()) {
    const { count, error } = await getSupabaseServer()
      .from("ats_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;
    return count ?? 0;
  }
  return (memory.get(userId) ?? []).length;
}

export async function listAtsChecks(userId: string, limit = 5): Promise<AtsCheckRow[]> {
  if (isSupabaseServerConfigured()) {
    const { data, error } = await getSupabaseServer()
      .from("ats_checks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AtsCheckRow[];
  }
  return (memory.get(userId) ?? []).slice(0, limit);
}

export async function recordAtsCheck(input: {
  userId: string;
  score: number;
  fileName: string | null;
  usedJobDescription: boolean;
}): Promise<void> {
  const row: AtsCheckRow = {
    id: crypto.randomUUID(),
    user_id: input.userId,
    score: input.score,
    file_name: input.fileName,
    used_job_description: input.usedJobDescription,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseServerConfigured()) {
    const { error } = await getSupabaseServer().from("ats_checks").insert({
      user_id: row.user_id,
      score: row.score,
      file_name: row.file_name,
      used_job_description: row.used_job_description,
    });
    if (error) throw error;
    return;
  }

  const list = memory.get(input.userId) ?? [];
  list.unshift(row);
  memory.set(input.userId, list);
}
