/**
 * Automation log store. TODO: persist to real DB.
 */
import type { AutomationLog, PlatformId } from "@/database/schemas";

const logs: AutomationLog[] = [];

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
  logs.unshift(log);
  return log;
}

export async function getUserLogs(userId: string, limit = 50): Promise<AutomationLog[]> {
  return logs.filter((l) => l.user_id === userId).slice(0, limit);
}
