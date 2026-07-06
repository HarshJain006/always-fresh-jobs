/**
 * Playwright worker.
 *
 * Design goals:
 *   - ONE Chromium instance for the entire process.
 *   - ONE isolated BrowserContext per user run — cheap to create, disposable.
 *   - Bounded concurrency so we don't hammer target portals.
 *
 * This module is server-only. Do not import it from React components.
 */

import { chromium, type Browser, type BrowserContext } from "playwright";
import type { PlatformId } from "@/database/schemas";
import { getAdapter } from "./platforms";
import type { PlatformCredentials, RunContext } from "./platforms/types";
import { saveLog } from "./logs";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--disable-gpu", "--disable-notifications"],
    });
  }
  return browserPromise;
}

export async function shutdown(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  await b.close();
  browserPromise = null;
}

async function withContext<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  });
  try {
    return await fn(context);
  } finally {
    await context.close().catch(() => {});
  }
}

export interface UserRunInput {
  userId: string;
  platform: PlatformId;
  resumePath: string;
  credentials: PlatformCredentials;
}

export interface UserRunResult {
  userId: string;
  platform: PlatformId;
  ok: boolean;
  message: string;
  durationMs: number;
}

export async function runPlatformForUser(input: UserRunInput): Promise<UserRunResult> {
  const started = Date.now();
  const adapter = getAdapter(input.platform);
  const messages: string[] = [];
  const run: RunContext = {
    userId: input.userId,
    resumePath: input.resumePath,
    credentials: input.credentials,
    logger: (m) => {
      console.log(`[${input.userId} · ${adapter.name}] ${m}`);
      messages.push(m);
    },
  };

  try {
    return await withContext(async (ctx) => {
      const loggedIn = await adapter.login(ctx, run);
      if (!loggedIn) throw new Error("login failed");
      const uploaded = await adapter.uploadResume(ctx, run);
      if (!uploaded) throw new Error("upload failed");
      const verified = await adapter.verifyUpdate(ctx, run);
      await adapter.logout(ctx, run);
      const ok = verified;
      const msg = ok ? `Resume updated on ${adapter.name}` : `Update could not be verified on ${adapter.name}`;
      await saveLog({ userId: input.userId, platform: input.platform, ok, message: msg });
      return { userId: input.userId, platform: input.platform, ok, message: msg, durationMs: Date.now() - started };
    });
  } catch (err) {
    const message = `Failed on ${adapter.name}: ${String(err)}`;
    await saveLog({ userId: input.userId, platform: input.platform, ok: false, message });
    return { userId: input.userId, platform: input.platform, ok: false, message, durationMs: Date.now() - started };
  }
}

/** Run many users with bounded concurrency, sharing one browser instance. */
export async function runBatch(
  inputs: UserRunInput[],
  concurrency = 4,
): Promise<UserRunResult[]> {
  const results: UserRunResult[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
    while (cursor < inputs.length) {
      const idx = cursor++;
      results[idx] = await runPlatformForUser(inputs[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}
