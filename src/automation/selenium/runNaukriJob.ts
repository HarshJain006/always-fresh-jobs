/**
 * Orchestrates a full Naukri refresh job using the tested Selenium flow from naukri-ts.
 * Server/worker-only. Always headless in SaaS.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { WebDriver } from "selenium-webdriver";
import { logMsg, logError } from "./logger";
import { naukriLogin, updateProfile, uploadResume, logout, tearDown } from "./naukri";
import { updateResume } from "./resume";
import type { NaukriCredentials } from "./types";

export interface RunNaukriJobInput {
  username: string;
  password: string;
  mobile: string;
  resumePath: string;
  headless?: boolean;
  updatePdf?: boolean;
}

export interface RunNaukriJobResult {
  ok: boolean;
  message: string;
  lastUpdated: string | null;
}

export async function runNaukriJob(input: RunNaukriJobInput): Promise<RunNaukriJobResult> {
  logMsg("-----Naukri job begin-----");

  if (!fs.existsSync(input.resumePath)) {
    const message = `Resume not found at ${input.resumePath}`;
    logMsg(message);
    logMsg("-----Naukri job ended-----\n");
    return { ok: false, message, lastUpdated: null };
  }

  const creds: NaukriCredentials = {
    username: input.username,
    password: input.password,
    mobile: input.mobile,
    originalResumePath: input.resumePath,
    modifiedResumePath: path.join(path.dirname(input.resumePath), "Naukri_Resume_Updated.pdf"),
    naukriLoginUrl: "https://www.naukri.com/nlogin/login",
    naukriProfileUrl: "https://www.naukri.com/mnjuser/profile",
    updatePdf: input.updatePdf ?? true,
    headless: input.headless ?? true, // SaaS runs headless
  };

  let driver: WebDriver | null = null;
  let ok = false;
  let lastUpdated: string | null = null;
  let message = "Naukri update failed";

  try {
    const result = await naukriLogin(creds);
    driver = result.driver;

    if (result.status && driver) {
      await updateProfile(driver, creds.mobile);

      let resumePath = creds.originalResumePath;
      if (creds.updatePdf) {
        resumePath = await updateResume(creds.originalResumePath, creds.modifiedResumePath);
      }

      const upload = await uploadResume(driver, resumePath, creds.naukriProfileUrl);
      ok = upload.ok;
      lastUpdated = upload.lastUpdated;
      message = ok
        ? `Resume updated on Naukri${lastUpdated ? ` (${lastUpdated})` : ""}`
        : `Resume upload could not be verified on Naukri${lastUpdated ? ` — last updated: ${lastUpdated}` : ""}`;
    } else {
      message = "Naukri login failed";
    }
  } catch (e) {
    logError(e, "runNaukriJob");
    message = `Naukri job error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    if (driver) {
      try {
        await logout(driver);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        logMsg(`Error during logout: ${e}`);
      }
    }
    await tearDown(driver);
  }

  logMsg(`-----Naukri job ended (${ok ? "ok" : "fail"})-----\n`);
  return { ok, message, lastUpdated };
}
