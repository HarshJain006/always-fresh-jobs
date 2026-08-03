/**
 * Naukri.com Selenium automation — ported from naukri-ts (tested & working).
 * Server/worker-only. Never import from React components.
 */

import { Builder, By, Key, type WebDriver } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import "chromedriver";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { logMsg, logError } from "./logger";
import {
  getElement,
  isElementPresent,
  waitTillElementPresent,
  waitTillAnyPresent,
  ci,
  sleep,
} from "./selenium-helpers";
import { logPdfFileDetails } from "./resume";
import type { NaukriCredentials } from "./types";

/** Chrome profile dirs keyed by WebDriver — each parallel job needs its own dir. */
const chromeProfiles = new WeakMap<WebDriver, string>();

const USERNAME_CANDIDATES = [
  { value: "usernameField", type: "ID" as const },
  { value: "emailTxt", type: "ID" as const },
  { value: "USERNAME", type: "NAME" as const },
  { value: "username", type: "NAME" as const },
  {
    value: "//input[@type='text' and (contains(@placeholder,'Email') or contains(@placeholder,'Username'))]",
    type: "XPATH" as const,
  },
];

const PASSWORD_CANDIDATES = [
  { value: "passwordField", type: "ID" as const },
  { value: "pwd1", type: "ID" as const },
  { value: "PASSWORD", type: "NAME" as const },
  { value: "password", type: "NAME" as const },
  { value: "//input[@type='password']", type: "XPATH" as const },
];

const LOGIN_BTN_CANDIDATES = [
  { value: "//*[@type='submit' and normalize-space()='Login']", type: "XPATH" as const },
  { value: "//button[@type='submit']", type: "XPATH" as const },
  { value: "//button[contains(.,'Login')]", type: "XPATH" as const },
];

/** Mirrors naukri-ts LoadNaukri(): launches Chrome and navigates to the login URL. */
export async function loadNaukri(headless: boolean, loginUrl: string): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments("--disable-notifications");
  options.addArguments("--start-maximized");
  options.addArguments("--disable-popups");
  options.addArguments("--disable-gpu");
  options.addArguments("--window-size=1920,1080");
  options.addArguments("--no-sandbox");
  options.addArguments("--disable-dev-shm-usage");
  options.addArguments("--disable-software-rasterizer");
  options.addArguments("--lang=en-IN");

  // Critical for 4 parallel slots: shared default profile causes blank/broken logins
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "dailyresume-chrome-"));
  options.addArguments(`--user-data-dir=${profileDir}`);
  options.addArguments(`--remote-debugging-port=0`);

  options.excludeSwitches("enable-automation");
  options.addArguments("--disable-blink-features=AutomationControlled");

  options.setUserPreferences({
    credentials_enable_service: false,
    profile: {
      password_manager_enabled: false,
    },
  });

  options.addArguments(
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  );
  if (headless) {
    options.addArguments("--headless=new");
  }

  const service = new chrome.ServiceBuilder("/usr/bin/chromedriver");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeService(service)
    .setChromeOptions(options)
    .build();

  chromeProfiles.set(driver, profileDir);

  await driver.executeScript(`
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});
`);
  logMsg(`Google Chrome Launched (profile=${profileDir})`);

  // Explicit waits only — non-zero implicit makes every miss hang and breaks parallel retries
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 90000, script: 30000 });
  await driver.get(loginUrl);
  await sleep(2500);
  return driver;
}

/** Dismiss cookie / consent overlays that can hide the login form. */
async function dismissLoginInterstitials(driver: WebDriver): Promise<void> {
  const candidates = [
    "//button[contains(translate(.,'ACEIPT','aceipt'),'accept')]",
    "//button[contains(translate(.,'GOT IT','got it'),'got it')]",
    "//button[contains(.,'Accept')]",
    "//button[contains(.,'OK')]",
    "//*[contains(@class,'cross-icon') or @alt='cross-icon' or contains(@class,'crossIcon')]",
  ];
  for (const xpath of candidates) {
    try {
      if (await isElementPresent(driver, By.xpath(xpath))) {
        const el = await driver.findElement(By.xpath(xpath));
        await el.click();
        await sleep(800);
        logMsg(`Dismissed interstitial: ${xpath}`);
      }
    } catch {
      /* ignore */
    }
  }
}

/** Try default document + iframes for login fields (Naukri occasionally wraps the form). */
async function switchToLoginContext(driver: WebDriver): Promise<boolean> {
  try {
    await driver.switchTo().defaultContent();
  } catch {
    /* ignore */
  }

  const userHit = await waitTillAnyPresent(driver, USERNAME_CANDIDATES, 2);
  if (userHit) return true;

  let frames: Awaited<ReturnType<WebDriver["findElements"]>> = [];
  try {
    frames = await driver.findElements(By.css("iframe"));
  } catch {
    frames = [];
  }

  for (let i = 0; i < Math.min(frames.length, 6); i++) {
    try {
      await driver.switchTo().defaultContent();
      await driver.switchTo().frame(frames[i]);
      const hit = await waitTillAnyPresent(driver, USERNAME_CANDIDATES, 2);
      if (hit) {
        logMsg(`Login form found inside iframe index=${i}`);
        return true;
      }
    } catch {
      /* try next frame */
    }
  }

  try {
    await driver.switchTo().defaultContent();
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Wait for username/password fields. If missing, hard-reload and retry.
 * Naukri often needs a reload on slow Pi / flaky CDN / parallel Chrome load.
 */
async function ensureLoginFormReady(
  driver: WebDriver,
  loginUrl: string,
  maxAttempts = 5,
): Promise<{ user: { value: string; type: string }; pass: { value: string; type: string } } | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logMsg(`Waiting for Naukri login form (attempt ${attempt}/${maxAttempts})…`);
    await dismissLoginInterstitials(driver);
    await switchToLoginContext(driver);

    const user = await waitTillAnyPresent(driver, USERNAME_CANDIDATES, 18);
    const pass = user ? await waitTillAnyPresent(driver, PASSWORD_CANDIDATES, 10) : null;

    if (user && pass) {
      logMsg(`Naukri login form ready (user=${user.type}:${user.value}, pass=${pass.type}:${pass.value}).`);
      return { user, pass };
    }

    try {
      const title = await driver.getTitle();
      const url = await driver.getCurrentUrl();
      logMsg(`Login form not ready — title="${title}" url="${url}"`);
    } catch (e) {
      logMsg(`Could not read page state: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (attempt >= maxAttempts) break;

    logMsg("Hard-reloading Naukri login page…");
    try {
      await driver.manage().deleteAllCookies();
    } catch {
      /* ignore */
    }
    try {
      await driver.switchTo().defaultContent();
    } catch {
      /* ignore */
    }
    await driver.get(loginUrl);
    await sleep(3000 + attempt * 1000);
  }
  return null;
}

/** Mirrors naukri-ts naukriLogin(): logs into Naukri, returns login status + the driver. */
export async function naukriLogin(
  creds: NaukriCredentials,
): Promise<{ status: boolean; driver: WebDriver | null; error?: string }> {
  const skipLocator = "//*[text() = 'SKIP AND CONTINUE']";
  const closeLocator = "//*[contains(@class, 'cross-icon') or @alt='cross-icon']";
  const loginErrorXpath = [
    "//*[contains(@class,'server-err')]",
    "//*[contains(@class,'err-msg')]",
    "//*[contains(text(),'Invalid details')]",
    "//*[contains(text(),'Email ID - Password')]",
    "//*[contains(text(),'incorrect') or contains(text(),'Incorrect')]",
    "//*[contains(text(),'Invalid username') or contains(text(),'invalid password')]",
  ].join(" | ");

  const PAGE_LOAD_RETRY_MSG =
    "Naukri login page did not load correctly — will retry.";

  // Full browser restarts — fixes most "works on 2nd try" failures under 4-wide concurrency
  const maxBrowserAttempts = 3;
  let lastError = PAGE_LOAD_RETRY_MSG;

  for (let browserAttempt = 1; browserAttempt <= maxBrowserAttempts; browserAttempt++) {
    let driver: WebDriver | null = null;
    try {
      if (browserAttempt > 1) {
        const pause = 2500 + browserAttempt * 1500 + Math.floor(Math.random() * 2000);
        logMsg(`Restarting Chrome for login (attempt ${browserAttempt}/${maxBrowserAttempts}) after ${pause}ms…`);
        await sleep(pause);
      }

      driver = await loadNaukri(creds.headless, creds.naukriLoginUrl);

      const title = await driver.getTitle();
      logMsg(title);
      if (title.toLowerCase().includes("naukri")) {
        logMsg("Website Loaded Successfully.");
      }

      const form = await ensureLoginFormReady(driver, creds.naukriLoginUrl, 5);
      if (!form) {
        lastError = PAGE_LOAD_RETRY_MSG;
        logMsg("Login form missing after refresh retries — quitting this Chrome instance.");
        await tearDown(driver);
        driver = null;
        continue;
      }

      const emailField = await getElement(driver, form.user.value, form.user.type);
      await sleep(400);
      const passField = await getElement(driver, form.pass.value, form.pass.type);
      await sleep(400);

      let loginButton = null as Awaited<ReturnType<typeof getElement>>;
      for (const btn of LOGIN_BTN_CANDIDATES) {
        loginButton = await getElement(driver, btn.value, btn.type);
        if (loginButton) break;
      }

      if (!emailField || !passField || !loginButton) {
        lastError = PAGE_LOAD_RETRY_MSG;
        logMsg("Login form fields incomplete after presence check.");
        await tearDown(driver);
        driver = null;
        continue;
      }

      await emailField.clear();
      await emailField.sendKeys(creds.username);
      await sleep(800);
      await passField.clear();
      await passField.sendKeys(creds.password);
      await sleep(800);
      await loginButton.sendKeys(Key.ENTER);
      await sleep(3500);

      logMsg("Checking Skip button");
      if (await waitTillElementPresent(driver, closeLocator, "XPATH", 8)) {
        const el = await getElement(driver, closeLocator, "XPATH");
        await el?.click();
      }
      if (await waitTillElementPresent(driver, skipLocator, "XPATH", 5)) {
        const el = await getElement(driver, skipLocator, "XPATH");
        await el?.click();
      }

      if (await waitTillElementPresent(driver, "ff-inventory", "ID", 45)) {
        const checkpoint = await getElement(driver, "ff-inventory", "ID");
        if (checkpoint) {
          logMsg("Naukri Login Successful");
          return { status: true, driver };
        }
      }

      const stillOnLogin =
        (await waitTillAnyPresent(driver, PASSWORD_CANDIDATES, 2)) !== null;
      let errorText = "";
      try {
        if (await isElementPresent(driver, By.xpath(loginErrorXpath))) {
          const errEl = await getElement(driver, loginErrorXpath, "XPATH");
          errorText = ((await errEl?.getText()) || "").trim();
        }
      } catch {
        /* ignore */
      }

      if (stillOnLogin) {
        const explicitCredFail =
          /invalid details|incorrect.*(password|username)|wrong.*(password|username)|invalid username|invalid password|email id\s*[-–]\s*password/i.test(
            errorText,
          );
        if (explicitCredFail) {
          const message =
            "Naukri login failed — incorrect username or password. Update your Naukri credentials and try again.";
          logMsg(message + (errorText ? ` (Naukri: ${errorText})` : ""));
          return { status: false, driver, error: message };
        }
        // Still on login without a clear credential banner → flaky page, keep retrying
        lastError = "Naukri login page did not load correctly — will retry.";
        logMsg(`${lastError}${errorText ? ` (page: ${errorText})` : ""}`);
        await tearDown(driver);
        driver = null;
        continue;
      }

      lastError = "Naukri login could not be confirmed — will retry.";
      logMsg(lastError);
      await tearDown(driver);
      driver = null;
    } catch (e) {
      logError(e, `naukriLogin(attempt ${browserAttempt})`);
      lastError = `Naukri login error — will retry. (${e instanceof Error ? e.message : String(e)})`;
      if (driver) {
        await tearDown(driver);
        driver = null;
      }
    }
  }

  return { status: false, driver: null, error: lastError };
}

/** Mirrors naukri-ts UpdateProfile(): updates the mobile number on the profile. */
export async function updateProfile(driver: WebDriver, mobile: string): Promise<void> {
  try {
    const mobXpath = "//*[@name='mobile'] | //*[@id='mob_number']";
    const saveXpath =
      "//button[@type='submit'][@value='Save Changes'] | //*[@id='saveBasicDetailsBtn']";
    const viewProfileLocator = "//*[contains(@class, 'view-profile')]//a";
    const editLocator = "(//*[contains(@class, 'icon edit')])[1]";
    const saveConfirm = "//*[text()='today' or text()='Today']";
    const closeLocator = "//*[contains(@class, 'crossIcon')]";

    await waitTillElementPresent(driver, viewProfileLocator, "XPATH", 20);
    const profElement = await getElement(driver, viewProfileLocator, "XPATH");
    await profElement?.click();
    await sleep(2000);

    if (await waitTillElementPresent(driver, closeLocator, "XPATH", 10)) {
      const el = await getElement(driver, closeLocator, "XPATH");
      await el?.click();
      await sleep(2000);
    }

    await waitTillElementPresent(driver, `${editLocator} | ${saveXpath}`, "XPATH", 20);

    if (await isElementPresent(driver, By.xpath(editLocator))) {
      const editElement = await getElement(driver, editLocator, "XPATH");
      await editElement?.click();

      await waitTillElementPresent(driver, mobXpath, "XPATH", 10);
      const mobField = await getElement(driver, mobXpath, "XPATH");
      if (mobField) {
        await mobField.clear();
        await mobField.sendKeys(mobile);
        await sleep(2000);
      }

      const saveField = await getElement(driver, saveXpath, "XPATH");
      await saveField?.sendKeys(Key.ENTER);
      await sleep(3000);

      if (await waitTillElementPresent(driver, saveConfirm, "XPATH", 10)) {
        logMsg("Profile Update Successful");
      } else {
        logMsg("Profile Update Failed");
      }
    } else if (await isElementPresent(driver, By.xpath(saveXpath))) {
      const mobField = await getElement(driver, mobXpath, "XPATH");
      if (mobField) {
        await mobField.clear();
        await mobField.sendKeys(mobile);
        await sleep(2000);
      }

      const saveField = await getElement(driver, saveXpath, "XPATH");
      await saveField?.sendKeys(Key.ENTER);
      await sleep(3000);

      if (await waitTillElementPresent(driver, "confirmMessage", "ID", 10)) {
        logMsg("Profile Update Successful");
      } else {
        logMsg("Profile Update Failed");
      }
    }

    await sleep(5000);
  } catch (e) {
    logError(e, "updateProfile");
  }
}

function screenshotPath(label: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeLabel = label.replace(/[^\w.-]+/g, "_");
  const dir = path.join(process.cwd(), ".data", "screenshots", "naukri");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${stamp}_${safeLabel}.png`);
}

/** Screenshots are opt-in only (NAUKRI_SCREENSHOTS=1) — off for daily production to save disk. */
async function saveScreenshot(driver: WebDriver, label: string): Promise<void> {
  if (process.env.NAUKRI_SCREENSHOTS !== "1") return;
  try {
    const filePath = screenshotPath(label);
    const image = await driver.takeScreenshot();
    fs.writeFileSync(filePath, image, "base64");
    logMsg(`Screenshot saved (${label}): ${filePath}`);
  } catch (e) {
    logError(e, `saveScreenshot(${label})`);
  }
}

/**
 * Send a file path only to a real <input type="file">.
 * Returns false (does not throw) for non-file elements so callers can try the next locator.
 */
async function sendKeysToFileInput(
  driver: WebDriver,
  locator: string,
  locatorType: "ID" | "XPATH",
  filePath: string,
  label: string,
): Promise<boolean> {
  try {
    const el = await getElement(driver, locator, locatorType);
    if (!el) {
      logMsg(`${label}: element not found`);
      return false;
    }

    let tag = "";
    let type = "";
    try {
      tag = ((await el.getTagName()) || "").toLowerCase();
      type = ((await el.getAttribute("type")) || "").toLowerCase();
    } catch {
      /* ignore */
    }

    logMsg(`${label}: tag=${tag || "?"}, type=${type || "?"}`);

    // lazyAttachCV is often a <div> trigger — never sendKeys to it
    if (tag !== "input" || type !== "file") {
      logMsg(`${label}: skipped — not an <input type="file">`);
      return false;
    }

    await el.sendKeys(filePath);
    logMsg(`${label}: sendKeys completed for ${filePath}`);
    return true;
  } catch (e) {
    logMsg(`${label}: sendKeys failed — ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/** XPaths for Naukri "last updated" / "uploaded on" — UI varies by account age/layout. */
const LAST_UPDATED_XPATHS = [
  "//*[contains(@class, 'updateOn')]",
  "//*[contains(@class, 'update-on')]",
  "//*[contains(@class, 'update_on')]",
  "//*[contains(@class, 'cvDetails')]//*[contains(text(), 'Uploaded')]",
  "//*[contains(@class, 'resume')]//*[contains(text(), 'Uploaded on')]",
  "//*[contains(text(), 'Uploaded on')]",
  "//*[contains(text(), 'Last updated')]",
] as const;

async function scrollToResumeSection(driver: WebDriver): Promise<void> {
  for (const id of ["lazyAttachCV", "attachCV"]) {
    try {
      const el = await driver.findElement(By.id(id));
      await driver.executeScript("arguments[0].scrollIntoView({block:'center'});", el);
      await sleep(800);
      return;
    } catch {
      /* try next */
    }
  }
  await driver.executeScript("window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.55));");
  await sleep(500);
}

/** Quiet popup dismiss — missing close icon is normal, not an error. */
async function dismissProfilePopups(driver: WebDriver, closeLocator: string): Promise<void> {
  try {
    const locator = By.xpath(closeLocator);
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      if (await isElementPresent(driver, locator)) {
        const el = await driver.findElement(locator);
        await el.click();
        await sleep(1000);
        return;
      }
      await sleep(400);
    }
  } catch {
    /* popup not present — ignore */
  }
}

/** Try several locators without logging every miss (avoids noisy logs on new-account layouts). */
async function readLastUpdatedDate(
  driver: WebDriver,
  waitSeconds = 0,
): Promise<string | null> {
  if (waitSeconds > 0) {
    const deadline = Date.now() + waitSeconds * 1000;
    while (Date.now() < deadline) {
      const found = await readLastUpdatedDateOnce(driver);
      if (found) return found;
      await sleep(990);
    }
    return await readLastUpdatedFromBody(driver);
  }
  const once = await readLastUpdatedDateOnce(driver);
  return once ?? (await readLastUpdatedFromBody(driver));
}

async function readLastUpdatedDateOnce(driver: WebDriver): Promise<string | null> {
  for (const xpath of LAST_UPDATED_XPATHS) {
    try {
      const el = await driver.findElement(By.xpath(xpath));
      const text = ((await el.getText()) || "").trim();
      if (
        text.length > 0 &&
        (/uploaded/i.test(text) || /updated/i.test(text) || /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(text))
      ) {
        return text;
      }
    } catch {
      /* try next locator */
    }
  }
  return null;
}

/** Fallback when structured locators miss — common on first-upload / alternate profile layouts. */
async function readLastUpdatedFromBody(driver: WebDriver): Promise<string | null> {
  try {
    const bodyText = await driver.findElement(By.tagName("body")).getText();
    const uploaded = bodyText.match(/Uploaded on\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/i);
    if (uploaded) return uploaded[0].trim();
    const lastUpdated = bodyText.match(/Last updated[:\s]+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}/i);
    if (lastUpdated) return lastUpdated[0].trim();
  } catch {
    /* ignore */
  }
  return null;
}

function verifyUploadDate(beforeDate: string | null, afterDate: string): boolean {
  const dateChanged =
    beforeDate !== null && afterDate !== beforeDate && afterDate.length > 0;
  const isToday = checkContainsToday(afterDate);
  // First-ever upload: no prior date on page, but today's date appears after sendKeys
  const firstUpload = beforeDate === null && isToday;
  return dateChanged || isToday || firstUpload;
}

/**
 * Multi-phase verification — upload path is unchanged; only how we confirm success.
 * Phase 1: wait on current page (matches naukri-ts, works when DOM updates in-place).
 * Phase 2: refresh + retry (existing accounts where date only updates after reload).
 * Phase 3: re-open profile + scroll + body-text fallback (new-account layouts).
 */
async function verifyResumeUpload(
  driver: WebDriver,
  profileUrl: string,
  beforeDate: string | null,
  closeLocator: string,
): Promise<{ ok: boolean; lastUpdated: string | null; via: string }> {
  // Phase 1 — no refresh (naukri-ts behaviour)
  await dismissProfilePopups(driver, closeLocator);
  await scrollToResumeSection(driver);
  let afterDate = await readLastUpdatedDate(driver, 15);
  if (afterDate && verifyUploadDate(beforeDate, afterDate)) {
    return { ok: true, lastUpdated: afterDate, via: "in-place DOM" };
  }

  // Phase 2 — refresh then re-check (unchanged path for established accounts)
  logMsg("In-place verification inconclusive — refreshing profile page…");
  await driver.navigate().refresh();
  await sleep(5000);
  await dismissProfilePopups(driver, closeLocator);
  await scrollToResumeSection(driver);
  afterDate = await readLastUpdatedDate(driver, 20);
  if (afterDate && verifyUploadDate(beforeDate, afterDate)) {
    return { ok: true, lastUpdated: afterDate, via: "after refresh" };
  }

  // Phase 3 — full re-navigation + body-text fallback (new accounts / alternate UI)
  logMsg("Post-refresh verification inconclusive — re-opening profile…");
  await driver.get(profileUrl);
  await sleep(4000);
  await dismissProfilePopups(driver, closeLocator);
  await scrollToResumeSection(driver);
  afterDate = await readLastUpdatedDate(driver, 15);
  if (afterDate && verifyUploadDate(beforeDate, afterDate)) {
    return { ok: true, lastUpdated: afterDate, via: "re-navigation" };
  }

  if (afterDate) {
    return { ok: false, lastUpdated: afterDate, via: "date unchanged" };
  }
  return { ok: false, lastUpdated: null, via: "not found" };
}

/**
 * Mirrors naukri-ts UploadResume().
 *
 * lazyAttachCV is usually a <div> (presence signal only). Actual upload goes to:
 *   1) uploadCVBtn file input (when lazyAttachCV is present), and/or
 *   2) #attachCV file input
 * Both paths are attempted (not exclusive), matching the working backup.
 */
export async function uploadResume(
  driver: WebDriver,
  resumePath: string,
  profileUrl: string,
): Promise<{ ok: boolean; lastUpdated: string | null }> {
  let ok = false;
  let lastUpdated: string | null = null;
  try {
    const attachCVID = "attachCV";
    const lazyAttachCVID = "lazyAttachCV";
    const uploadCVBtn = "//*[contains(@class, 'upload')]//input[@value='Update resume']";
    const fileInputXpath = "//input[@type='file']";
    const closeLocator = "//*[contains(@class, 'crossIcon')]";
    const resolvedPath = path.resolve(resumePath);

    await logPdfFileDetails("Selenium upload file", resolvedPath);
    logMsg(`Navigating to profile: ${profileUrl}`);
    await driver.get(profileUrl);
    await sleep(3000);

    if (await waitTillElementPresent(driver, closeLocator, "XPATH", 10)) {
      const el = await getElement(driver, closeLocator, "XPATH");
      await el?.click();
      await sleep(2000);
    }

    let beforeDate: string | null = null;
    await scrollToResumeSection(driver);
    beforeDate = await readLastUpdatedDate(driver, 5);
    logMsg(`Before-upload date: ${beforeDate ?? "(not found)"}`);

    let sentCount = 0;

    // Path A (naukri-ts): lazyAttachCV present → sendKeys to uploadCVBtn (the file input near it)
    if (await waitTillElementPresent(driver, lazyAttachCVID, "ID", 5)) {
      logMsg("Found lazyAttachCV (presence signal) — targeting uploadCVBtn / nested file inputs");

      // Click the div if needed to reveal the file input (lazy-loaded UI)
      try {
        const lazyEl = await getElement(driver, lazyAttachCVID, "ID");
        const tag = ((await lazyEl?.getTagName()) || "").toLowerCase();
        if (lazyEl && tag === "div") {
          await driver.executeScript("arguments[0].scrollIntoView({block:'center'});", lazyEl);
          await sleep(500);
          await lazyEl.click();
          logMsg("Clicked lazyAttachCV div to reveal file input");
          await sleep(1500);
        }
      } catch (e) {
        logMsg(`lazyAttachCV click skipped: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (await sendKeysToFileInput(driver, uploadCVBtn, "XPATH", resolvedPath, "uploadCVBtn")) {
        sentCount++;
      }
      // Also try any file input inside/near lazyAttachCV
      const nestedFile =
        `//*[@id='${lazyAttachCVID}']//input[@type='file'] | //input[@id='${lazyAttachCVID}' and @type='file']`;
      if (await sendKeysToFileInput(driver, nestedFile, "XPATH", resolvedPath, "lazyAttachCV_nested_file")) {
        sentCount++;
      }
    }

    // Path B (naukri-ts): ALWAYS try #attachCV when present
    if (await waitTillElementPresent(driver, attachCVID, "ID", 5)) {
      logMsg("Found attachCV");
      if (await sendKeysToFileInput(driver, attachCVID, "ID", resolvedPath, "attachCV")) {
        sentCount++;
      }
    }

    // Fallback: first visible file input on the page
    if (sentCount === 0 && (await waitTillElementPresent(driver, fileInputXpath, "XPATH", 5))) {
      logMsg("Trying generic file input fallback");
      if (await sendKeysToFileInput(driver, fileInputXpath, "XPATH", resolvedPath, "generic_file_input")) {
        sentCount++;
      }
    }

    if (sentCount === 0) {
      logMsg("Could not find any usable <input type='file'> to upload the resume.");
      return { ok: false, lastUpdated: null };
    }

    logMsg(`File path sent to ${sentCount} file input(s). Waiting for Naukri to process…`);
    await sleep(8000);

    const verified = await verifyResumeUpload(driver, profileUrl, beforeDate, closeLocator);
    lastUpdated = verified.lastUpdated;
    ok = verified.ok;

    if (ok) {
      logMsg(
        `Resume Document Upload Successful (${verified.via}). Last Updated = ${lastUpdated ?? "—"}`,
      );
    } else if (lastUpdated) {
      logMsg(
        `Resume upload FAILED verification. Before=${beforeDate ?? "(not found)"}, After=${lastUpdated} (${verified.via})`,
      );
    } else {
      logMsg(`Resume Document Upload: last-updated date not found (${verified.via}).`);
    }
  } catch (e) {
    logError(e, "uploadResume");
  }
  await sleep(2000);
  return { ok, lastUpdated };
}

/** Check if a Naukri date string (e.g. "Uploaded on Jul 29, 2026") contains today's IST date. */
function checkContainsToday(text: string): boolean {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Use IST (UTC+5:30) — not the Pi's local system clock
  const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const utcAdjusted = new Date(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate());

  const month = monthNames[utcAdjusted.getMonth()];
  const day = utcAdjusted.getDate();
  const year = utcAdjusted.getFullYear();

  // "Jul 29, 2026" or "Jul 09, 2026"
  const padded = `${month} ${String(day).padStart(2, "0")}, ${year}`;
  const unpadded = `${month} ${day}, ${year}`;

  return text.includes(padded) || text.includes(unpadded);
}

/** Mirrors naukri-ts Logout(). */
export async function logout(driver: WebDriver): Promise<boolean> {
  try {
    const drawerXpaths = [
      `//*[contains(${ci("@class")}, 'drawer__icon')]`,
      `//div[contains(${ci("@class")}, 'drawer')]`,
    ];

    for (const xpath of drawerXpaths) {
      if (await isElementPresent(driver, By.xpath(xpath))) {
        try {
          const el = await getElement(driver, xpath, "XPATH");
          if (el) {
            await el.click();
            await sleep(1000);
            logMsg("Drawer menu opened");
            break;
          }
        } catch (e) {
          logMsg(`Drawer open failed (${xpath}): ${e}`);
          continue;
        }
      }
    }

    const logoutXpaths = [
      "//a[@data-type='logoutLink']",
      `//a[contains(${ci("@class")}, 'list-cta') and contains(${ci("@title")}, 'logout')]`,
      `//a[contains(${ci("@class")}, 'logout')]`,
      `//a[contains(${ci("@href")}, 'logout')]`,
      `//*[contains(${ci("text()")}, 'logout')]`,
      `//*[contains(${ci(".")}, 'logout')]`,
    ];

    for (const xpath of logoutXpaths) {
      if (await isElementPresent(driver, By.xpath(xpath))) {
        try {
          const el = await getElement(driver, xpath, "XPATH");
          if (el) {
            await driver.executeScript("arguments[0].scrollIntoView(true);", el);
            await sleep(500);
            await el.click();
            await sleep(2000);
            logMsg("Logout Successful");
            return true;
          }
        } catch (e) {
          logMsg(`Logout click failed (${xpath}): ${e}`);
          continue;
        }
      }
    }

    logMsg("Logout button not found");
    return false;
  } catch (e) {
    logMsg(`Logout error: ${e}`);
    return false;
  }
}

/** Mirrors naukri-ts tearDown(): closes then quits the driver and removes Chrome profile. */
export async function tearDown(driver: WebDriver | null): Promise<void> {
  if (!driver) return;
  const profileDir = chromeProfiles.get(driver);
  try {
    await driver.close();
    logMsg("Driver Closed Successfully");
  } catch (e) {
    logError(e, "tearDown-close");
  }
  try {
    await driver.quit();
    logMsg("Driver Quit Successfully");
  } catch (e) {
    logError(e, "tearDown-quit");
  }
  if (profileDir) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      logMsg(`Removed Chrome profile ${profileDir}`);
    } catch (e) {
      logMsg(`Could not remove Chrome profile: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
