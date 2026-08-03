/**
 * Orchestrates a full Naukri refresh job using the tested Selenium flow from naukri-ts.
 * Server/worker-only. Always headless in SaaS.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { WebDriver } from "selenium-webdriver";
import { logMsg, logError } from "./logger";
import { naukriLogin, updateProfile, uploadResume, logout, tearDown } from "./naukri";
import { logPdfFileDetails, updateResume } from "./resume";
import type { NaukriCredentials } from "./types";

export interface RunNaukriJobInput {
  username: string;
  password: string;
  mobile: string;
  resumePath: string;
  /** Original filename the user uploaded (shown on Naukri after upload). */
  originalFileName?: string;
  headless?: boolean;
}

export interface RunNaukriJobResult {
  ok: boolean;
  message: string;
  lastUpdated: string | null;
}

/** Keep the user's resume name for Naukri; never use internal storage names. */
function sanitizeResumeFileName(originalName: string | undefined, fallbackPath: string): string {
  const raw = (originalName || path.basename(fallbackPath) || "resume.pdf").trim();
  let base = path.basename(raw).replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").replace(/\s+/g, " ").trim();
  if (!base || /^latest\.pdf$/i.test(base) || /^naukri_resume_updated\.pdf$/i.test(base)) {
    base = "Resume.pdf";
  }
  const withExt = /\.pdf$/i.test(base) ? base : `${base}.pdf`;
  return withExt.slice(0, 120);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runNaukriJob(input: RunNaukriJobInput): Promise<RunNaukriJobResult> {
  logMsg("-----Naukri job begin-----");

  if (!fs.existsSync(input.resumePath)) {
    const message = `Resume not found at ${input.resumePath}`;
    logMsg(message);
    logMsg("-----Naukri job ended-----\n");
    return { ok: false, message, lastUpdated: null };
  }
  await logPdfFileDetails("Resolved resume from storage/cache", input.resumePath);

  // Stagger parallel slots so 4 Chromes don't hammer Naukri login at the same instant
  const staggerMax = Number(process.env.NAUKRI_START_STAGGER_MS || 6000);
  if (staggerMax > 0) {
    const wait = Math.floor(Math.random() * staggerMax);
    logMsg(`Start stagger ${wait}ms (max ${staggerMax})`);
    await sleep(wait);
  }

  const creds: NaukriCredentials = {
    username: input.username,
    password: input.password,
    mobile: input.mobile,
    originalResumePath: input.resumePath,
    naukriLoginUrl: "https://www.naukri.com/nlogin/login",
    naukriProfileUrl: "https://www.naukri.com/mnjuser/profile",
    headless: input.headless ?? true,
  };

  let driver: WebDriver | null = null;
  let ok = false;
  let lastUpdated: string | null = null;
  let message = "Naukri update failed";
  let uploadDir: string | null = null;

  try {
    const result = await naukriLogin(creds);
    driver = result.driver;

    if (result.status && driver) {
      await updateProfile(driver, creds.mobile);

      // Stamp PDF so Naukri detects a content change, but keep the user's filename
      const uploadName = sanitizeResumeFileName(input.originalFileName, input.resumePath);
      uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "dailyresume-upload-"));
      const modifiedPath = path.join(uploadDir, uploadName);
      logMsg(`Upload filename for Naukri: ${uploadName}`);
      const resumePath = await updateResume(creds.originalResumePath, modifiedPath);
      await logPdfFileDetails("User resume passed to Naukri upload", resumePath);

      const upload = await uploadResume(driver, resumePath, creds.naukriProfileUrl);
      ok = upload.ok;
      lastUpdated = upload.lastUpdated;
      message = ok
        ? `Resume updated on Naukri${lastUpdated ? ` (${lastUpdated})` : ""}`
        : `Resume upload could not be verified on Naukri${lastUpdated ? ` — last updated: ${lastUpdated}` : ""}`;
    } else {
      message =
        result.error ||
        "Naukri login could not be confirmed — will retry.";
    }
  } catch (e) {
    logError(e, "runNaukriJob");
    message = `Naukri job error: ${e instanceof Error ? e.message : String(e)}`;
  } finally {
    if (driver) {
      try {
        await logout(driver);
        await sleep(2000);
      } catch (e) {
        logMsg(`Error during logout: ${e}`);
      }
    }
    await tearDown(driver);
    if (uploadDir) {
      try {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  logMsg(`-----Naukri job ended (${ok ? "ok" : "fail"})-----\n`);
  return { ok, message, lastUpdated };
}
