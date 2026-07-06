import type { PlatformId } from "@/database/schemas";
import type { PlatformAdapter } from "./types";
import { naukriAdapter } from "./naukri";
import { indeedAdapter } from "./indeed";
import { linkedinAdapter } from "./linkedin";

export const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  naukri: naukriAdapter,
  indeed: indeedAdapter,
  linkedin: linkedinAdapter,
};

export function getAdapter(id: PlatformId): PlatformAdapter {
  return ADAPTERS[id];
}
