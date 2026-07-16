import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { logMsg, logError } from "./logger";

export type LocatorType = "ID" | "NAME" | "XPATH" | "TAG" | "CLASS" | "CSS" | "LINKTEXT";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getLocator(locatorType: LocatorType | string, value: string): By {
  switch (locatorType.toUpperCase()) {
    case "ID":
      return By.id(value);
    case "NAME":
      return By.name(value);
    case "XPATH":
      return By.xpath(value);
    case "TAG":
      return By.tagName(value);
    case "CLASS":
      return By.className(value);
    case "CSS":
      return By.css(value);
    case "LINKTEXT":
      return By.linkText(value);
    default:
      throw new Error(`Unknown locator type: ${locatorType}`);
  }
}

export async function isElementPresent(driver: WebDriver, locator: By): Promise<boolean> {
  try {
    await driver.findElement(locator);
    return true;
  } catch {
    return false;
  }
}

export async function getElement(
  driver: WebDriver,
  tag: string,
  locatorType: LocatorType | string = "ID",
  timeoutMs = 15000,
): Promise<WebElement | null> {
  try {
    const locator = getLocator(locatorType, tag);
    if (await isElementPresent(driver, locator)) {
      return await driver.wait(until.elementLocated(locator), timeoutMs);
    }
    logMsg(`Element not found with ${locatorType} : ${tag}`);
    return null;
  } catch (e) {
    logError(e, "getElement");
    return null;
  }
}

export async function waitTillElementPresent(
  driver: WebDriver,
  tag: string,
  locatorType: LocatorType | string = "ID",
  timeoutSeconds = 30,
): Promise<boolean> {
  const locator = getLocator(locatorType, tag);
  const start = Date.now();
  while (Date.now() - start < timeoutSeconds * 1000) {
    await sleep(990);
    try {
      if (await isElementPresent(driver, locator)) {
        return true;
      }
    } catch (e) {
      logMsg(`Exception when waitTillElementPresent : ${e}`);
    }
  }
  logMsg(`Element not found with ${locatorType} : ${tag}`);
  return false;
}

/** Case-insensitive XPath fragment helper. */
export function ci(xpathPart: string): string {
  return `translate(${xpathPart},'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')`;
}
