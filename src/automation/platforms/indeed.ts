/**
 * Indeed automation adapter. TODO: implement full flow.
 * Skeleton follows the same PlatformAdapter contract as Naukri.
 */
import type { PlatformAdapter } from "./types";

export const indeedAdapter: PlatformAdapter = {
  id: "indeed",
  name: "Indeed",
  async login(_ctx, run) {
    run.logger("Indeed: TODO — implement login");
    return false;
  },
  async uploadResume(_ctx, run) {
    run.logger("Indeed: TODO — implement resume upload");
    return false;
  },
  async verifyUpdate(_ctx, run) {
    run.logger("Indeed: TODO — implement verification");
    return false;
  },
  async logout(_ctx, run) {
    run.logger("Indeed: TODO — implement logout");
    return true;
  },
};
