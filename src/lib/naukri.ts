import { WebDriver, Key } from "selenium-webdriver";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  getElement,
  isElementPresent,
  waitTillElementPresent,
  buildLocator,
  loadNaukri,
  tearDown,
} from "../browser";
import { logMsg, catchError, randomText, randInt, sleep } from "../utils";

const DEFAULT_NAUKRI_LOGIN_URL = "https://www.naukri.com/nlogin/login";
const DEFAULT_NAUKRI_PROFILE_URL = "https://www.naukri.com/mnjuser/profile";

export interface NaukriAutomationConfig {
  username: string;
  password: string;
  mobile: string;
  resumeFilePath: string;
  updatePdf?: boolean;
  modifiedResumePath?: string;
  naukriLoginUrl?: string;
  naukriProfileUrl?: string;
}

export interface NaukriAutomationResult {
  success: boolean;
  message: string;
}

function getNaukriLoginUrl(): string {
  return process.env.NAUKRI_LOGIN_URL || DEFAULT_NAUKRI_LOGIN_URL;
}

function getNaukriProfileUrl(): string {
  return process.env.NAUKRI_PROFILE_URL || DEFAULT_NAUKRI_PROFILE_URL;
}

function ci(xpathPart: string): string {
  return `translate(${xpathPart},'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')`;
}

export async function runNaukriAutomation(
  config: NaukriAutomationConfig
): Promise<NaukriAutomationResult> {
  const loginUrl = config.naukriLoginUrl || getNaukriLoginUrl();
  const profileUrl = config.naukriProfileUrl || getNaukriProfileUrl();
  const modifiedResumePath =
    config.modifiedResumePath ||
    path.join(path.dirname(config.resumeFilePath), `modified-${path.basename(config.resumeFilePath)}`);

  let driver: WebDriver | null = null;

  try {
    const result = await naukriLogin({ ...config, naukriLoginUrl: loginUrl });
    driver = result.driver;
    if (!result.status || !driver) {
      return { success: false, message: "Naukri login failed. Check username/password." };
    }

    await updateProfile(driver, config.mobile);

    const resumePath = config.updatePdf
      ? await updateResume(config.resumeFilePath, modifiedResumePath)
      : config.resumeFilePath;

    await uploadResume(driver, resumePath, profileUrl);

    return { success: true, message: "Naukri automation completed successfully." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: msg };
  } finally {
    await tearDown(driver);
  }
}

export async function naukriLogin(
  config: NaukriAutomationConfig & { naukriLoginUrl: string }
): Promise<{ status: boolean; driver: WebDriver | null }> {
  let status = false;
  let driver: WebDriver | null = null;

  const usernameLocator = "usernameField";
  const passwordLocator = "passwordField";
  const loginBtnLocator = "//*[@type='submit' and normalize-space()='Login']";
  const skipLocator = "//*[text() = 'SKIP AND CONTINUE']";
  const closeLocator = "//*[contains(@class, 'cross-icon') or @alt='cross-icon']";
  const loginErrorXpath =
    "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'invalid') or contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'incorrect') or contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'wrong')]";

  try {
    driver = await loadNaukri(false, config.naukriLoginUrl);

    await waitTillElementPresent(driver, usernameLocator, "ID", 20);
    const emailFieldElement = await getElement(driver, usernameLocator, "ID");
    const passFieldElement = await getElement(driver, passwordLocator, "ID");
    const loginButton = await getElement(driver, loginBtnLocator, "XPATH");

    if (!emailFieldElement || !passFieldElement || !loginButton) {
      throw new Error("Naukri login page did not load correctly.");
    }

    await emailFieldElement.clear();
    await emailFieldElement.sendKeys(config.username);
    await passFieldElement.clear();
    await passFieldElement.sendKeys(config.password);
    await loginButton.sendKeys(Key.ENTER);
    await sleep(4000);

    if (
      (await isElementPresent(driver, buildLocator(usernameLocator, "ID"))) ||
      (await isElementPresent(driver, buildLocator(passwordLocator, "ID")))
    ) {
      throw new Error("Naukri login failed: invalid username or password.");
    }

    if (await waitTillElementPresent(driver, loginErrorXpath, "XPATH", 5)) {
      const errorElement = await getElement(driver, loginErrorXpath, "XPATH");
      const text = errorElement ? await errorElement.getText() : "Invalid credentials";
      throw new Error(`Naukri login failed: ${text}`);
    }

    if (await waitTillElementPresent(driver, closeLocator, "XPATH", 10)) {
      const el = await getElement(driver, closeLocator, "XPATH");
      if (el) await el.click();
    }
    if (await waitTillElementPresent(driver, skipLocator, "XPATH", 5)) {
      const el = await getElement(driver, skipLocator, "XPATH");
      if (el) await el.click();
    }

    if (await waitTillElementPresent(driver, "ff-inventory", "ID", 40)) {
      const checkPoint = await getElement(driver, "ff-inventory", "ID");
      if (checkPoint) {
        status = true;
      }
    }

    if (!status) {
      throw new Error("Naukri login failed: unable to confirm successful login.");
    }

    return { status, driver };
  } catch (error) {
    catchError(error, "naukriLogin");
    if (driver) {
      await tearDown(driver);
      driver = null;
    }
    throw error;
  }
}

export async function updateProfile(driver: WebDriver, mobile: string): Promise<void> {
  // ...existing updateProfile code...
}

export async function updateResume(
  originalResumePath: string,
  modifiedResumePath: string
): Promise<string> {
  // ...existing updateResume code...
}

export async function uploadResume(
  driver: WebDriver,
  resumePath: string,
  profileUrl: string
): Promise<void> {
  // ...existing uploadResume code...
}

export async function logout(driver: WebDriver): Promise<boolean> {
  // ...existing logout code...
}
