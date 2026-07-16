/**
 * Naukri.com Selenium automation — ported from naukri-ts (tested & working).
 * Server/worker-only. Never import from React components.
 */

import { Builder, By, Key, type WebDriver } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import "chromedriver";
import * as path from "node:path";
import { logMsg, logError } from "./logger";
import { getElement, isElementPresent, waitTillElementPresent, ci, sleep } from "./selenium-helpers";
import type { NaukriCredentials } from "./types";

/** Mirrors naukri-ts LoadNaukri(): launches Chrome and navigates to the login URL. */
export async function loadNaukri(headless: boolean, loginUrl: string): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments("--disable-notifications");
  options.addArguments("--start-maximized");
  options.addArguments("--disable-popups");
  options.addArguments("--disable-gpu");

  options.excludeSwitches("enable-automation");
  options.addArguments("--disable-blink-features=AutomationControlled");

  options.setUserPreferences({
    credentials_enable_service: false,
    profile: {
      password_manager_enabled: false,
    },
  });

  options.addArguments(
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  );
  if (headless) {
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--headless=new");
  }

  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  await driver.executeScript(`
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});
`);
  logMsg("Google Chrome Launched!");

  await driver.manage().setTimeouts({ implicit: 5000 });
  await driver.get(loginUrl);
  return driver;
}

/** Mirrors naukri-ts naukriLogin(): logs into Naukri, returns login status + the driver. */
export async function naukriLogin(
  creds: NaukriCredentials,
): Promise<{ status: boolean; driver: WebDriver | null }> {
  let status = false;
  let driver: WebDriver | null = null;

  const usernameLocator = "usernameField";
  const passwordLocator = "passwordField";
  const loginBtnLocator = "//*[@type='submit' and normalize-space()='Login']";
  const skipLocator = "//*[text() = 'SKIP AND CONTINUE']";
  const closeLocator = "//*[contains(@class, 'cross-icon') or @alt='cross-icon']";

  try {
    driver = await loadNaukri(creds.headless, creds.naukriLoginUrl);

    const title = await driver.getTitle();
    logMsg(title);
    if (title.toLowerCase().includes("naukri.com")) {
      logMsg("Website Loaded Successfully.");
    }

    let emailField = null;
    let passField = null;
    let loginButton = null;

    if (await isElementPresent(driver, By.id(usernameLocator))) {
      emailField = await getElement(driver, usernameLocator, "ID");
      await sleep(1000);
      passField = await getElement(driver, passwordLocator, "ID");
      await sleep(1000);
      loginButton = await getElement(driver, loginBtnLocator, "XPATH");
    } else {
      logMsg("None of the elements found to login.");
    }

    if (emailField && passField && loginButton) {
      await emailField.clear();
      await emailField.sendKeys(creds.username);
      await sleep(1000);
      await passField.clear();
      await passField.sendKeys(creds.password);
      await sleep(1000);
      await loginButton.sendKeys(Key.ENTER);
      await sleep(3000);

      logMsg("Checking Skip button");
      if (await waitTillElementPresent(driver, closeLocator, "XPATH", 10)) {
        const el = await getElement(driver, closeLocator, "XPATH");
        await el?.click();
      }
      if (await waitTillElementPresent(driver, skipLocator, "XPATH", 5)) {
        const el = await getElement(driver, skipLocator, "XPATH");
        await el?.click();
      }

      // Checkpoint to verify login succeeded
      if (await waitTillElementPresent(driver, "ff-inventory", "ID", 40)) {
        const checkpoint = await getElement(driver, "ff-inventory", "ID");
        if (checkpoint) {
          logMsg("Naukri Login Successful");
          status = true;
          return { status, driver };
        }
        logMsg("Unknown Login Error");
        return { status, driver };
      }
      logMsg("Unknown Login Error");
      return { status, driver };
    }
  } catch (e) {
    logError(e, "naukriLogin");
  }
  return { status, driver };
}

/** Mirrors naukri-ts UpdateProfile(): updates the mobile number on the profile. */
export async function updateProfile(driver: WebDriver, mobile: string): Promise<void> {
  try {
    const mobXpath = "//*[@name='mobile'] | //*[@id='mob_number']";
    const saveXpath = "//button[@type='submit'][@value='Save Changes'] | //*[@id='saveBasicDetailsBtn']";
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

/**
 * Mirrors naukri-ts UploadResume().
 * Returns ok/lastUpdated so the SaaS worker can write Recent activity.
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
    const checkpointXpath = "//*[contains(@class, 'updateOn')]";
    const saveXpath = "//button[@type='button']";
    const closeLocator = "//*[contains(@class, 'crossIcon')]";

    await driver.get(profileUrl);
    await sleep(2000);

    if (await waitTillElementPresent(driver, closeLocator, "XPATH", 10)) {
      const el = await getElement(driver, closeLocator, "XPATH");
      await el?.click();
      await sleep(2000);
    }

    if (await waitTillElementPresent(driver, lazyAttachCVID, "ID", 5)) {
      const attachElement = await getElement(driver, uploadCVBtn, "XPATH");
      await attachElement?.sendKeys(path.resolve(resumePath));
    }

    if (await waitTillElementPresent(driver, attachCVID, "ID", 5)) {
      const attachElement = await getElement(driver, attachCVID, "ID");
      await attachElement?.sendKeys(path.resolve(resumePath));
    }

    if (await waitTillElementPresent(driver, saveXpath, "ID", 5)) {
      const saveElement = await getElement(driver, saveXpath, "XPATH");
      await saveElement?.click();
    }

    await waitTillElementPresent(driver, checkpointXpath, "XPATH", 30);
    const checkpoint = await getElement(driver, checkpointXpath, "XPATH");
    if (checkpoint) {
      const lastUpdatedDate = await checkpoint.getText();
      lastUpdated = lastUpdatedDate;
      const today = new Date();
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
      // Cover both zero-padded ("Jul 04, 2026") and non-padded ("Jul 4, 2026") day formats
      const todaysDatePadded = `${monthNames[today.getMonth()]} ${String(today.getDate()).padStart(2, "0")}, ${today.getFullYear()}`;
      const todaysDateUnpadded = `${monthNames[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

      if (lastUpdatedDate.includes(todaysDatePadded) || lastUpdatedDate.includes(todaysDateUnpadded)) {
        logMsg(`Resume Document Upload Successful. Last Updated date = ${lastUpdatedDate}`);
        ok = true;
      } else {
        logMsg(`Resume Document Upload failed. Last Updated date = ${lastUpdatedDate}`);
      }
    } else {
      logMsg("Resume Document Upload failed. Last Updated date not found.");
    }
  } catch (e) {
    logError(e, "uploadResume");
  }
  await sleep(2000);
  return { ok, lastUpdated };
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

/** Mirrors naukri-ts tearDown(): closes then quits the driver. */
export async function tearDown(driver: WebDriver | null): Promise<void> {
  if (!driver) return;
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
}
