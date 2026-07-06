import type { BrowserContext } from "playwright";
import type { PlatformId } from "@/database/schemas";

export interface PlatformCredentials {
  username: string;
  password: string;
  extra?: Record<string, string>; // e.g. mobile
}

export interface RunContext {
  userId: string;
  resumePath: string;
  credentials: PlatformCredentials;
  logger: (msg: string) => void;
}

export interface PlatformAdapter {
  id: PlatformId;
  name: string;
  login(ctx: BrowserContext, run: RunContext): Promise<boolean>;
  uploadResume(ctx: BrowserContext, run: RunContext): Promise<boolean>;
  verifyUpdate(ctx: BrowserContext, run: RunContext): Promise<boolean>;
  logout(ctx: BrowserContext, run: RunContext): Promise<boolean>;
}
