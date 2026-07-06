/**
 * LinkedIn automation adapter. TODO: implement full flow.
 * LinkedIn has aggressive bot detection — plan for MFA + rate-limits.
 */
import type { PlatformAdapter } from "./types";

export const linkedinAdapter: PlatformAdapter = {
  id: "linkedin",
  name: "LinkedIn",
  async login(_ctx, run) {
    run.logger("LinkedIn: TODO — implement login");
    return false;
  },
  async uploadResume(_ctx, run) {
    run.logger("LinkedIn: TODO — implement resume upload");
    return false;
  },
  async verifyUpdate(_ctx, run) {
    run.logger("LinkedIn: TODO — implement verification");
    return false;
  },
  async logout(_ctx, run) {
    run.logger("LinkedIn: TODO — implement logout");
    return true;
  },
};
